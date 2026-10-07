/**
 * @jest-environment node
 */
import { parseWav, toPcm16Wav } from '@/server/sampark/audio-format';

/** Build a μ-law WAV with an extra LIST chunk before data, like real encoders emit. */
function mulawWav(samples: number[]): Buffer {
    const data = Buffer.from(samples);
    const fmt = Buffer.alloc(8 + 18);
    fmt.write('fmt ', 0, 'ascii');
    fmt.writeUInt32LE(18, 4);
    fmt.writeUInt16LE(7, 8);          // μ-law
    fmt.writeUInt16LE(1, 10);         // mono
    fmt.writeUInt32LE(8000, 12);
    fmt.writeUInt32LE(8000, 16);
    fmt.writeUInt16LE(1, 20);
    fmt.writeUInt16LE(8, 22);
    const list = Buffer.concat([Buffer.from('LIST', 'ascii'), Buffer.from([3, 0, 0, 0]), Buffer.from('abc\0', 'ascii')]);
    const dataHdr = Buffer.alloc(8);
    dataHdr.write('data', 0, 'ascii');
    dataHdr.writeUInt32LE(data.length, 4);
    const body = Buffer.concat([Buffer.from('WAVE', 'ascii'), fmt, list, dataHdr, data]);
    const riff = Buffer.alloc(8);
    riff.write('RIFF', 0, 'ascii');
    riff.writeUInt32LE(body.length, 4);
    return Buffer.concat([riff, body]);
}

describe('toPcm16Wav', () => {
    it('expands μ-law samples to 16-bit PCM with the G.711 table', () => {
        // 0xFF and 0x7F are the two μ-law zero codes; 0x80 / 0x00 are the extremes.
        const pcm = toPcm16Wav(mulawWav([0xff, 0x7f, 0x80, 0x00]));
        const layout = parseWav(pcm);
        expect(layout).toMatchObject({ formatTag: 1, channels: 1, sampleRate: 8000, bitsPerSample: 16, dataLength: 8 });
        const s = (i: number) => pcm.readInt16LE(layout.dataOffset + i * 2);
        expect(s(0)).toBe(0);
        expect(s(1)).toBe(0);
        expect(s(2)).toBe(32124);
        expect(s(3)).toBe(-32124);
    });

    it('keeps the duration: one μ-law byte becomes one 16-bit sample', () => {
        const samples = new Array(8000).fill(0xff);
        const layout = parseWav(toPcm16Wav(mulawWav(samples)));
        expect(layout.dataLength / 2 / layout.sampleRate).toBe(1);
    });

    it('returns PCM input unchanged and rejects non-WAV input', () => {
        const pcm = toPcm16Wav(mulawWav([0xff, 0xff]));
        expect(toPcm16Wav(pcm)).toBe(pcm);
        expect(() => toPcm16Wav(Buffer.from('not audio at all'))).toThrow('not a RIFF/WAVE file');
    });
});

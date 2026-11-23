/**
 * The demo school's sidebar shows the signed-in role's sections and name, but
 * never on the role picker: the browser may still hold the last role there
 * (bug: "Meera Ghosh, Principal" stayed on screen while choosing a teacher).
 */

import { demoNavRole } from '@/components/sampark/demo/demo-frame';

describe('demoNavRole', () => {
    it('is nobody on the role picker, whatever the stored role', () => {
        expect(demoNavRole('/demo', 'admin')).toBeNull();
        expect(demoNavRole('/demo/', 'teacher')).toBeNull();
    });

    it('is the stored role on every page inside the demo', () => {
        expect(demoNavRole('/demo/admin', 'admin')).toBe('admin');
        expect(demoNavRole('/demo/teacher/calls', 'teacher')).toBe('teacher');
        expect(demoNavRole('/demo/admin', null)).toBeNull();
        expect(demoNavRole('/demo/admin', undefined)).toBeNull();
    });
});

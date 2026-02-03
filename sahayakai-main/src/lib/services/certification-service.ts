import { query } from '@/lib/db/sql';

export interface Certification {
    id: string;
    userId: string;
    certName: string;
    issuingBody: string;
    issueDate: string;
    expiryDate?: string;
    verificationUrl?: string;
    status: 'verified' | 'pending' | 'rejected';
}

export const certificationService = {
    async getCertificationsByUser(userId: string): Promise<Certification[]> {
        const result = await query(
            'SELECT * FROM certifications WHERE user_id = $1 ORDER BY issue_date DESC',
            [userId]
        );
        return result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            certName: row.cert_name,
            issuingBody: row.issuing_body,
            issueDate: row.issue_date,
            expiryDate: row.expiry_date,
            verificationUrl: row.verification_url,
            status: row.status
        }));
    },

    async addCertification(cert: Omit<Certification, 'id' | 'status'>): Promise<string> {
        const id = crypto.randomUUID();
        await query(
            `INSERT INTO certifications (id, user_id, cert_name, issuing_body, issue_date, expiry_date, verification_url, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                id,
                cert.userId,
                cert.certName,
                cert.issuingBody,
                cert.issueDate,
                cert.expiryDate,
                cert.verificationUrl,
                'pending'
            ]
        );
        return id;
    },

    async verifyCertification(id: string, status: 'verified' | 'rejected'): Promise<void> {
        await query(
            'UPDATE certifications SET status = $1 WHERE id = $2',
            [status, id]
        );
    }
};

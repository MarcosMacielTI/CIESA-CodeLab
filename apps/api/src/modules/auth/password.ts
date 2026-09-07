import bcrypt from 'bcryptjs';

const saltRounds = 12;

export function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, saltRounds);
}

export function comparePassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
}

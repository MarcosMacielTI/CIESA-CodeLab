import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { appConfig } from '@ciesa/config';

const issuer = 'ciesa-codelab-api';

type AuthTokenPayload = JwtPayload & { sub: string };

function getJwtSecret(): string {
    if (!appConfig.jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
    }

    return appConfig.jwtSecret;
}

export function createAuthToken(userId: string): string {
    const options: SignOptions = {
        expiresIn: appConfig.jwtExpiresIn as SignOptions['expiresIn'],
        issuer
    };

    return jwt.sign({}, getJwtSecret(), { ...options, subject: userId });
}

export function verifyAuthToken(token: string): string {
    const payload = jwt.verify(token, getJwtSecret(), { issuer });

    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
        throw new Error('Invalid authentication token');
    }

    return (payload as AuthTokenPayload).sub;
}

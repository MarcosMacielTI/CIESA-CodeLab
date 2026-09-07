import type { PublicUser } from '@ciesa/contracts';

declare module 'express-serve-static-core' {
    interface Request {
        authenticatedUser?: PublicUser;
    }
}

export { };

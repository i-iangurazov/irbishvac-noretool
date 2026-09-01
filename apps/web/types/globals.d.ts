export {};

declare global {
  interface CustomJwtSessionClaims {
    primaryEmail?: string;
  }
}

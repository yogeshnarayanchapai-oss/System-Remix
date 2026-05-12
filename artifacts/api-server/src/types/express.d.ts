import type { User, OrganizationMember } from "@workspace/db/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      membership?: OrganizationMember | null;
    }
  }
}

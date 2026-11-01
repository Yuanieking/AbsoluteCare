import UserModel, {
  type AccountAuditEntry,
  type User,
  type UserDoc,
  type UserRole,
} from "../models/userModel.js";
import Dependent from "../models/dependentModel.js";
import type { ProfileUpdateInput } from "../schemas/authSchema.js";

export type { UserDoc, UserRole };

export function findUserByEmail(email: string): Promise<UserDoc | null> {
  return UserModel.findOne({ email });
}

export function findActiveUserByEmail(email: string): Promise<UserDoc | null> {
  return UserModel.findOne({ email, isActive: true, removedAt: null });
}

export function findUserById(id: string | undefined): Promise<UserDoc | null> {
  return UserModel.findById(id);
}

export function findUserByResetToken(hash: string): Promise<UserDoc | null> {
  return UserModel.findOne({
    resetPasswordTokenHash: hash,
    resetPasswordExpiresAt: { $gt: new Date() },
    isActive: true,
    removedAt: null,
  });
}

// Audit entries are seeded as `{ action }`; the schema fills `at` and leaves `by` unset.
type NewUserInput = Omit<Partial<User>, "accountAudit"> & {
  accountAudit?: Array<Partial<AccountAuditEntry>>;
};

export function createUser(input: NewUserInput): Promise<UserDoc> {
  return UserModel.create(input);
}

export function updateUserProfile(
  id: string,
  input: ProfileUpdateInput,
): Promise<UserDoc | null> {
  return UserModel.findByIdAndUpdate(
    id,
    {
      firstname: input.firstName,
      lastname: input.lastName,
      phone: input.phone,
      dateOfBirth: input.dateOfBirth,
      address: input.address,
      profilePicture: input.profilePicture,
    },
    { new: true, runValidators: true },
  );
}

export function saveUser(user: UserDoc): Promise<UserDoc> {
  return user.save();
}

export async function userHasDependents(id: string): Promise<boolean> {
  return Boolean(await Dependent.exists({ guardian: id, isActive: true }));
}

import UserModel from "../models/userModel.js";
import Dependent from "../models/dependentModel.js";

import { assertNotStale, freshFilter } from "./concurrencyService.js";

export function findUserByEmail(email) {
  return UserModel.findOne({ email });
}

export function findActiveUserByEmail(email) {
  return UserModel.findOne({ email, isActive: true, removedAt: null });
}

export function findUserById(id) {
  return UserModel.findById(id);
}

export function findUserByResetToken(hash) {
  return UserModel.findOne({
    resetPasswordTokenHash: hash,
    resetPasswordExpiresAt: { $gt: new Date() },
    isActive: true,
    removedAt: null,
  });
}

export function createUser(input) {
  return UserModel.create(input);
}

export async function updateUserProfile(id, input, ifMatch) {
  // ** Concurrency: atomic compare-and-swap on updatedAt when If-Match is sent.
  const user = await UserModel.findOneAndUpdate(
    { _id: id, ...freshFilter(ifMatch) },
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
  if (!user) await assertNotStale(ifMatch, () => UserModel.exists({ _id: id }));
  return user;
}

export function saveUser(user) {
  return user.save();
}

export async function userHasDependents(id) {
  return Boolean(await Dependent.exists({ guardian: id, isActive: true }));
}

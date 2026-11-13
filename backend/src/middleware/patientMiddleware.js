import User from "../models/userModel.js";

export const requirePatient = async (req, res, next) => {
  const user = await User.findById(req.user.userId);

  if (!user || !["user", "patient"].includes(user.role)) {
    res.status(403).json({ message: "Patient access is required." });
    return;
  }

  req.patient = user;
  next();
};

const isProduction = process.env.NODE_ENV === "production";

export const cookieOptions = {
  maxAge: 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
};

export const jwtOptions = {
  expiresIn: "1d",
};

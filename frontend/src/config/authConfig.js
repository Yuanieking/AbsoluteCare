export const authModes = {
  login: {
    title: "Welcome back",
    description: "Log in to manage your appointments and keep care moving.",
    submit: "Log in",
  },
  signup: {
    title: "Create your account",
    description: "Set up your account to request appointments with ease.",
    submit: "Create account",
  },
  forgot: {
    title: "Reset your password",
    description:
      "Enter your email address and we'll send you a link to reset your password.",
    submit: "Send reset link",
  },
};

export const getAuthMode = (pathname, searchParams) => {
  const pathnameMode = {
    "/signup": "signup",
    "/forgot-password": "forgot",
  }[pathname];
  const requestedMode = pathnameMode || searchParams.get("mode") || "login";

  return authModes[requestedMode] ? requestedMode : "login";
};

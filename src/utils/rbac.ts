export const getUserRole = () => {
  return localStorage.getItem("role");
};

export const isManager = () => getUserRole() === "manager";
export const isDeveloper = () => getUserRole() === "developer";
export const isQA = () => getUserRole() === "qa";

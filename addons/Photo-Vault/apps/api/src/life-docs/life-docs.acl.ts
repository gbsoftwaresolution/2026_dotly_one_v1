export type LifeDocAclMember = {
  userId: string;
  role: "VIEWER" | "MANAGER";
};

export type LifeDocAclPayload = {
  sharedMembers: LifeDocAclMember[];
  guardians: LifeDocAclMember[];
  notifySharedMembers: boolean;
};

export const defaultAclPayload = (): LifeDocAclPayload => ({
  sharedMembers: [],
  guardians: [],
  notifySharedMembers: false,
});

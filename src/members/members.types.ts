export const MEMBER_STATUSES = ['invited', 'active', 'suspended', 'deactivated'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export type MemberFields = { name: string; status: MemberStatus };
export type CreateMemberInput = { name: string; status?: MemberStatus };
export type UpdateMemberInput = Partial<MemberFields>;

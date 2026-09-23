import { Invitation } from '../models';
import { IInvitation } from '../types';
import { Types } from 'mongoose';

export class InvitationRepository {
  async findById(invitationId: Types.ObjectId): Promise<IInvitation | null> {
    return Invitation.findById(invitationId).lean();
  }

  async findByToken(token: string): Promise<IInvitation | null> {
    return Invitation.findOne({ token }).lean();
  }

  async findByEmail(email: string): Promise<IInvitation[]> {
    return Invitation.find({ email }).lean();
  }

  async findByOrganizationId(organizationId: Types.ObjectId): Promise<IInvitation[]> {
    return Invitation.find({ organizationId }).lean();
  }

  async create(invitationData: Partial<IInvitation>): Promise<IInvitation> {
    const invitation = new Invitation(invitationData);
    return invitation.save();
  }

  async update(invitationId: Types.ObjectId, updateData: Partial<IInvitation>): Promise<IInvitation | null> {
    return Invitation.findByIdAndUpdate(invitationId, updateData, { new: true }).lean();
  }

  async delete(invitationId: Types.ObjectId): Promise<IInvitation | null> {
    return Invitation.findByIdAndDelete(invitationId).lean();
  }

  async deleteExpired(): Promise<number> {
    const result = await Invitation.deleteMany({ expiresAt: { $lt: new Date() } });
    return result.deletedCount || 0;
  }
}

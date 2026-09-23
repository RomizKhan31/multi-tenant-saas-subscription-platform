import { Organization } from '../models';
import { IOrganization as IOrganizationType } from '../types';
import { Types, ClientSession } from 'mongoose';

export class OrganizationRepository {
  async findById(organizationId: Types.ObjectId, session?: ClientSession): Promise<IOrganizationType | null> {
    const query = Organization.findById(organizationId);
    if (session) query.session(session);
    return query.lean();
  }

  async create(organizationData: Partial<IOrganizationType>, session?: ClientSession): Promise<IOrganizationType> {
    const organization = new Organization(organizationData);
    return organization.save({ session });
  }

  async update(
    organizationId: Types.ObjectId,
    updateData: Partial<IOrganizationType>,
    session?: ClientSession
  ): Promise<IOrganizationType | null> {
    return Organization.findByIdAndUpdate(organizationId, updateData, { new: true, session }).lean();
  }

  async findAll(filters: any = {}, skip = 0, limit = 50, session?: ClientSession): Promise<IOrganizationType[]> {
    const query = Organization.find(filters)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    if (session) query.session(session);
    return query.lean();
  }

  async count(filters: any = {}): Promise<number> {
    return Organization.countDocuments(filters);
  }

  async delete(organizationId: Types.ObjectId, session?: ClientSession): Promise<IOrganizationType | null> {
    return Organization.findByIdAndDelete(organizationId, { session }).lean();
  }
}

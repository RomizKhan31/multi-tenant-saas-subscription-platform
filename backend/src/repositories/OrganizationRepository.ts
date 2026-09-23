import { Organization, IOrganization } from '../models';
import { IOrganization as IOrganizationType } from '../types';
import { Types } from 'mongoose';

export class OrganizationRepository {
  async findById(organizationId: Types.ObjectId): Promise<IOrganizationType | null> {
    return Organization.findById(organizationId).lean();
  }

  async create(organizationData: Partial<IOrganization>): Promise<IOrganization> {
    const organization = new Organization(organizationData);
    return organization.save();
  }

  async update(organizationId: Types.ObjectId, updateData: Partial<IOrganization>): Promise<IOrganizationType | null> {
    return Organization.findByIdAndUpdate(organizationId, updateData, { new: true }).lean();
  }

  async findAll(filters: any = {}, skip = 0, limit = 50): Promise<IOrganizationType[]> {
    return Organization.find(filters)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();
  }

  async count(filters: any = {}): Promise<number> {
    return Organization.countDocuments(filters);
  }

  async delete(organizationId: Types.ObjectId): Promise<IOrganizationType | null> {
    return Organization.findByIdAndDelete(organizationId).lean();
  }
}

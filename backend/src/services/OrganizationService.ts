import { OrganizationRepository } from '../repositories';
import { UserRepository } from '../repositories';
import { IOrganization, OrganizationStatus } from '../types';
import { Types } from 'mongoose';

export class OrganizationService {
  constructor(
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository
  ) {}

  async createOrganization(organizationData: {
    name: string;
    contactEmail: string;
    billingEmail: string;
  }): Promise<IOrganization> {
    return this.organizationRepository.create(organizationData);
  }

  async getOrganizationById(organizationId: Types.ObjectId): Promise<IOrganization | null> {
    return this.organizationRepository.findById(organizationId);
  }

  async updateOrganization(
    organizationId: Types.ObjectId,
    updateData: {
      name?: string;
      contactEmail?: string;
      billingEmail?: string;
    }
  ): Promise<IOrganization | null> {
    return this.organizationRepository.update(organizationId, updateData);
  }

  async suspendOrganization(organizationId: Types.ObjectId): Promise<IOrganization | null> {
    return this.organizationRepository.update(organizationId, { status: OrganizationStatus.SUSPENDED });
  }

  async reactivateOrganization(organizationId: Types.ObjectId): Promise<IOrganization | null> {
    return this.organizationRepository.update(organizationId, { status: OrganizationStatus.ACTIVE });
  }

  async cancelOrganization(organizationId: Types.ObjectId): Promise<IOrganization | null> {
    return this.organizationRepository.update(organizationId, { status: OrganizationStatus.CANCELLED });
  }

  async getOrganizations(filters: any = {}, skip = 0, limit = 50): Promise<IOrganization[]> {
    return this.organizationRepository.findAll(filters, skip, limit);
  }

  async countOrganizations(filters: any = {}): Promise<number> {
    return this.organizationRepository.count(filters);
  }

  async getOrganizationMembers(organizationId: Types.ObjectId): Promise<any[]> {
    return this.userRepository.findByOrganizationId(organizationId);
  }

  async getMemberCount(organizationId: Types.ObjectId): Promise<number> {
    const members = await this.userRepository.findByOrganizationId(organizationId);
    return members.length;
  }
}

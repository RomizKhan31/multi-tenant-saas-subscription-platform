import {
  OrganizationRepository,
  UserRepository,
  SubscriptionRepository,
  PaymentRepository,
  TransactionRepository,
} from '../repositories';
import { IOrganization, IUser, OrganizationStatus } from '../types';
import { Types } from 'mongoose';

export class OrganizationService {
  constructor(
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository,
    private subscriptionRepository?: SubscriptionRepository,
    private paymentRepository?: PaymentRepository,
    private transactionRepository?: TransactionRepository
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

  async getOrganizationDetails(organizationId: Types.ObjectId): Promise<{
    organization: IOrganization;
    members: Omit<IUser, 'password'>[];
    subscriptions: any[];
    payments: any[];
    transactions: any[];
  } | null> {
    const organization = await this.organizationRepository.findById(organizationId);
    if (!organization) {
      return null;
    }

    const members = await this.userRepository.findByOrganizationId(organizationId);
    const sanitizedMembers = members.map((m: any) => {
      const { password: _password, ...rest } = m;
      return rest;
    });

    const subscriptions = this.subscriptionRepository
      ? await this.subscriptionRepository.findAll({ organizationId })
      : [];

    const payments = this.paymentRepository
      ? await this.paymentRepository.findByOrganizationId(organizationId)
      : [];

    const transactions = this.transactionRepository
      ? await this.transactionRepository.findByOrganizationId(organizationId)
      : [];

    return {
      organization,
      members: sanitizedMembers,
      subscriptions,
      payments,
      transactions,
    };
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

  async getOrganizationMembers(organizationId: Types.ObjectId): Promise<Omit<IUser, 'password'>[]> {
    const members = await this.userRepository.findByOrganizationId(organizationId);
    return members.map((m: any) => {
      const { password: _password, ...rest } = m;
      return rest;
    });
  }

  async getMemberCount(organizationId: Types.ObjectId): Promise<number> {
    const members = await this.userRepository.findByOrganizationId(organizationId);
    return members.length;
  }
}

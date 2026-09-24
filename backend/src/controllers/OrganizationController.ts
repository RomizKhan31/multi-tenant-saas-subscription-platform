import { Request, Response } from 'express';
import { OrganizationService } from '../services';
import { z } from 'zod';
import { IAuthRequest } from '../types';
import { Types } from 'mongoose';

const createOrganizationSchema = z.object({
  name: z.string().min(1),
  contactEmail: z.string().email(),
  billingEmail: z.string().email(),
});

const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  contactEmail: z.string().email().optional(),
  billingEmail: z.string().email().optional(),
});

const parseObjectId = (id: string | string[] | undefined): Types.ObjectId | null => {
  if (typeof id === 'string' && Types.ObjectId.isValid(id)) {
    return new Types.ObjectId(id);
  }
  return null;
};

export class OrganizationController {
  constructor(private organizationService: OrganizationService) {}

  createOrganization = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = createOrganizationSchema.parse(req.body);
      const organization = await this.organizationService.createOrganization(validatedData);
      res.status(201).json(organization);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  };

  getOrganization = async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = parseObjectId(req.params.id);
      if (!orgId) {
        res.status(400).json({ error: 'Invalid organization ID format' });
        return;
      }

      const organization = await this.organizationService.getOrganizationById(orgId);
      if (!organization) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }
      res.status(200).json(organization);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getOrganizationDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = parseObjectId(req.params.id);
      if (!orgId) {
        res.status(400).json({ error: 'Invalid organization ID format' });
        return;
      }

      const details = await this.organizationService.getOrganizationDetails(orgId);
      if (!details) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }
      res.status(200).json(details);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  updateOrganization = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const validatedData = updateOrganizationSchema.parse(req.body);
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      const organization = await this.organizationService.updateOrganization(
        organizationId,
        validatedData
      );
      
      if (!organization) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }
      
      res.status(200).json(organization);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  };

  getCurrentOrganization = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      const organization = await this.organizationService.getOrganizationById(organizationId);
      if (!organization) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      const response: Record<string, unknown> = {
        _id: organization._id,
        name: organization.name,
        status: organization.status,
        createdAt: organization.createdAt,
      };

      if (req.user?.role === 'ORGANIZATION_ADMIN') {
        response.contactEmail = organization.contactEmail;
        response.billingEmail = organization.billingEmail;
      }

      // Members receive only the non-financial organization information they need.
      res.status(200).json(response);
    } catch {
      res.status(500).json({ error: 'Unable to load organization' });
    }
  };

  suspendOrganization = async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = parseObjectId(req.params.id);
      if (!orgId) {
        res.status(400).json({ error: 'Invalid organization ID format' });
        return;
      }

      const organization = await this.organizationService.suspendOrganization(orgId);
      if (!organization) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }
      res.status(200).json(organization);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  reactivateOrganization = async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = parseObjectId(req.params.id);
      if (!orgId) {
        res.status(400).json({ error: 'Invalid organization ID format' });
        return;
      }

      const organization = await this.organizationService.reactivateOrganization(orgId);
      if (!organization) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }
      res.status(200).json(organization);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getOrganizations = async (req: Request, res: Response): Promise<void> => {
    try {
      const { search, status, page = '1', limit = '50' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const filters: any = {};
      if (search) {
        filters.name = { $regex: search as string, $options: 'i' };
      }
      if (status) {
        filters.status = status;
      }

      const [organizations, total] = await Promise.all([
        this.organizationService.getOrganizations(filters, skip, parseInt(limit as string)),
        this.organizationService.countOrganizations(filters),
      ]);

      res.status(200).json({
        organizations,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getOrganizationMembers = async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = parseObjectId(req.params.id);
      if (!orgId) {
        res.status(400).json({ error: 'Invalid organization ID format' });
        return;
      }

      const members = await this.organizationService.getOrganizationMembers(orgId);
      res.status(200).json({ members, count: members.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}

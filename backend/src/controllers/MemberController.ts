import { Request, Response } from 'express';
import { MemberService } from '../services';
import { z } from 'zod';
import { IAuthRequest, UserRole } from '../types';

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(UserRole).refine((val) => val === UserRole.ORGANIZATION_ADMIN || val === UserRole.ORGANIZATION_MEMBER),
});

const changeMemberRoleSchema = z.object({
  role: z.nativeEnum(UserRole).refine(
    (value) => value === UserRole.ORGANIZATION_ADMIN || value === UserRole.ORGANIZATION_MEMBER,
    { message: 'Organization members can only be assigned an organization role' }
  ),
});

const acceptInvitationSchema = z.object({
  token: z.string(),
  name: z.string().min(1),
  password: z.string().min(8),
});

export class MemberController {
  constructor(private memberService: MemberService) {}

  inviteMember = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const validatedData = inviteMemberSchema.parse(req.body);
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      await this.memberService.inviteMember(
        organizationId,
        validatedData.email,
        validatedData.role as UserRole.ORGANIZATION_ADMIN | UserRole.ORGANIZATION_MEMBER
      );
      
      res.status(200).json({ message: 'Invitation sent successfully' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  };

  acceptInvitation = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = acceptInvitationSchema.parse(req.body);
      const result = await this.memberService.acceptInvitation(
        validatedData.token,
        { name: validatedData.name, password: validatedData.password }
      );
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  };

  removeMember = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      await this.memberService.removeMember(organizationId, userId as any);
      res.status(200).json({ message: 'Member removed successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  changeMemberRole = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const validatedData = changeMemberRoleSchema.parse(req.body);
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      await this.memberService.changeMemberRole(organizationId, userId as any, validatedData.role);
      res.status(200).json({ message: 'Member role changed successfully' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  };

  getOrganizationMembers = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      const members = await this.memberService.getOrganizationMembers(organizationId);
      res.status(200).json({ members, count: members.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}

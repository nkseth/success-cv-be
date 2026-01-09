import { Router } from "express";
import logger from "../../middleware/logger.js";
import { sendSuccess } from "../../utils/apiHelpers.js";
import { createOrgByUserIDController, getOrgByIDController, getAllMembersofOrganisationController, getAllInvitesOfOrganisationController, inviteAMemberController, getAllCandidatesOfOrganisationController } from "../../controllers/organisation.controller.js";
import { authenticateUser, commonAuthenticate } from "../../middleware/authenticate-routes.js";

const router = Router();

router.use(commonAuthenticate)
router.get('/', (req, res, next) => {
    const userId = req.params.id;
    logger.info(`API v1 AUTH User organisations route accessed for user ID: ${userId}`);
    sendSuccess(res, { userId }, `Success-CV API v1 AUTH User organisations data for ID: ${userId}`);
});

router.post('/', (req, res, next) => {
    logger.info(`API v1 AUTH User organisations route accessed for user ID: ${req.userID}`);
    next();
}, authenticateUser, createOrgByUserIDController);

router.get('/:id', (req, res, next) => {
    const orgId = req.params.id;
    logger.info(`API v1 AUTH Organisation details route accessed for organisation ID: ${orgId}`);
    next();
}, getOrgByIDController);

router.get('/:id/invites', (req, res, next) => {
    const orgId = req.params.id;
    logger.info(`API v1 AUTH Organisation invites route accessed for organisation ID: ${orgId}`);
    next();
}, getAllInvitesOfOrganisationController);

router.post('/:id/invites', (req, res, next) => {
    const orgId = req.params.id;
    logger.info(`API v1 AUTH Send organisation invite route accessed for organisation ID: ${orgId}`);
    next();
}, inviteAMemberController);

router.get('/:id/members', (req, res, next) => {
    const orgId = req.params.id;
    logger.info(`API v1 AUTH Organisation members route accessed for organisation ID: ${orgId}`);
    next()
}, getAllMembersofOrganisationController);

router.post('/:id/members', (req, res, next) => {
    const orgId = req.params.id;
    logger.info(`API v1 AUTH Add member to organisation route accessed for organisation ID: ${orgId}`);
    sendSuccess(res, { orgId }, `Success-CV API v1 AUTH Add member to organisation ID: ${orgId}`);
});

router.patch('/:id/members/:memberId/role', (req, res, next) => {
    const { id: orgId, memberId } = req.params;
    logger.info(`API v1 AUTH Update member role route accessed for organisation ID: ${orgId}, member ID: ${memberId}`);
    sendSuccess(res, { orgId, memberId }, `Success-CV API v1 AUTH Update member role for organisation ID: ${orgId}, member ID: ${memberId}`);
});

router.get('/:id/candidates', (req, res, next) => {
    const orgId = req.params.id;
    logger.info(`API v1 AUTH Organisation candidates route accessed for organisation ID: ${orgId}`);
    next();
}, getAllCandidatesOfOrganisationController);

export const organisationRoutes = router;
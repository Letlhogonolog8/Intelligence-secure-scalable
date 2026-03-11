import Joi from 'joi';
import { createValidator } from 'express-joi-validation';

const validator = createValidator();

export const schemas = {
  escalate: Joi.object({
    caseId: Joi.string().required().alphanum().min(5),
    severity: Joi.string().required().valid('low', 'medium', 'high', 'critical'),
    reason: Joi.string().required().min(10).max(500),
    userId: Joi.string().required().uuid(),
  }),

  mfaSetup: Joi.object({
    userId: Joi.string().required().uuid(),
    username: Joi.string().required().min(3).max(100),
  }),

  mfaVerify: Joi.object({
    userId: Joi.string().required().uuid(),
    code: Joi.string().required().length(6).pattern(/^\d+$/),
  }),

  ussdCallback: Joi.object({
    phoneNumber: Joi.string().pattern(/^\+?[\d\s\-()]+$/).optional(),
    subscriber: Joi.string().pattern(/^\+?[\d\s\-()]+$/).optional(),
    sessionId: Joi.string().required(),
    userInput: Joi.string().max(180).optional().allow(''),
    input: Joi.string().max(180).optional().allow(''),
    language: Joi.string().valid('en', 'zu', 'xh', 'st', 'tn', 'ss', 'af', 'ts', 've', 'nso', 'nr').optional(),
  }).or('phoneNumber', 'subscriber').or('userInput', 'input'),

  ussdTest: Joi.object({
    phoneNumber: Joi.string().required().pattern(/^\+?[\d\s\-()]+$/),
    userInput: Joi.string().required().max(180),
    language: Joi.string().valid('en', 'zu', 'xh', 'st', 'tn', 'ss', 'af', 'ts', 've', 'nso', 'nr').optional(),
  }),

  authVerify: Joi.object({
    token: Joi.string().required(),
  }),
};

export const validationMiddleware = {
  escalate: validator.body(schemas.escalate),
  mfaSetup: validator.body(schemas.mfaSetup),
  mfaVerify: validator.body(schemas.mfaVerify),
  ussdCallback: validator.body(schemas.ussdCallback),
  ussdTest: validator.body(schemas.ussdTest),
  authVerify: validator.body(schemas.authVerify),
};

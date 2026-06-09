export const PowerType = {
  ICE: 'ICE',
  PHEV: 'PHEV',
  EV: 'EV',
} as const;

export type PowerType = (typeof PowerType)[keyof typeof PowerType];

export const PairType = {
  ICE_EV: 'ICE_EV',
  ICE_PHEV: 'ICE_PHEV',
  PHEV_EV: 'PHEV_EV',
} as const;

export type PairType = (typeof PairType)[keyof typeof PairType];

export const WeightGainCause = {
  BATTERY: 'BATTERY',
  SIZE: 'SIZE',
  FEATURES: 'FEATURES',
  MIXED: 'MIXED',
} as const;

export type WeightGainCause = (typeof WeightGainCause)[keyof typeof WeightGainCause];

export const CauseTag = {
  LARGE_BATTERY: 'LARGE_BATTERY',
  EXTENDED_WHEELBASE: 'EXTENDED_WHEELBASE',
  WIDER_BODY: 'WIDER_BODY',
  TALLER_BODY: 'TALLER_BODY',
  PREMIUM_TRIM: 'PREMIUM_TRIM',
  ADAS_FEATURES: 'ADAS_FEATURES',
  LUXURY_FEATURES: 'LUXURY_FEATURES',
  PERFORMANCE_UPGRADE: 'PERFORMANCE_UPGRADE',
} as const;

export type CauseTag = (typeof CauseTag)[keyof typeof CauseTag];

export const ChainStatus = {
  ACTIVE: 'ACTIVE',
  DRAFT: 'DRAFT',
  ARCHIVED: 'ARCHIVED',
} as const;

export type ChainStatus = (typeof ChainStatus)[keyof typeof ChainStatus];

export const VehicleClass = {
  SEDAN: 'SEDAN',
  SUV: 'SUV',
  MPV: 'MPV',
} as const;

export type VehicleClass = (typeof VehicleClass)[keyof typeof VehicleClass];

export const PairStatus = {
  PENDING: 'PENDING',
  PAIRED: 'PAIRED',
  REVIEW: 'REVIEW',
} as const;

export type PairStatus = (typeof PairStatus)[keyof typeof PairStatus];

export const TrimLevel = {
  BASE: 'BASE',
  MID: 'MID',
  HIGH: 'HIGH',
  PREMIUM: 'PREMIUM',
} as const;

export type TrimLevel = (typeof TrimLevel)[keyof typeof TrimLevel];

/**
 * Meridian Facilities Ltd and its people — spec §13.
 *
 * 62 staff, Manchester, soft FM contractor. The profile is built so the demo has
 * drama: one certification it does not hold, a turnover figure that is a near miss
 * rather than a wild one, and one insurance line that was never filled in.
 */

import type { OrganisationFixture, UserFixture } from './types';

export const demoUsers: UserFixture[] = [
  {
    key: 'owner',
    id: '9f2c1a70-4d3e-4a11-9b0e-2c7d5f8a1001',
    // The account behind the "View demo" button on /login.
    email: 'demo@verdict.app',
    displayName: 'Alex Whitfield',
  },
  {
    key: 'colleague',
    id: '9f2c1a70-4d3e-4a11-9b0e-2c7d5f8a1002',
    email: 'sam.okafor@meridianfacilities.co.uk',
    displayName: 'Sam Okafor',
  },
];

export const demoOrganisation: OrganisationFixture = {
  key: 'meridian',
  id: '3b8e5c42-91a7-4f6d-8e13-6a0c4b2d7000',
  name: 'Meridian Facilities Ltd',
  companiesHouseNumber: '07214883',
  headcount: 62,
  registeredRegion: 'England',
  // 81210 general cleaning of buildings, 81299 other cleaning, 81300 landscape services.
  sicCodes: ['81210', '81299', '81300'],
  memberships: [
    { user: 'owner', role: 'owner' },
    { user: 'colleague', role: 'member' },
  ],
};

/**
 * A second organisation, used by `src/lib/db/__tests__/tenancy.test.ts` (spec §6.3).
 * It owns nothing in the seed. The test creates its own rows against this id and
 * asserts that every exported read function returns nothing belonging to Meridian.
 */
export const otherOrganisation: OrganisationFixture = {
  key: 'kestrel',
  id: '5d1f7a93-2c84-4b05-a7f2-9e3b6c1d8000',
  name: 'Kestrel Support Services Ltd',
  companiesHouseNumber: '09883121',
  headcount: 18,
  registeredRegion: 'Scotland',
  sicCodes: ['81210'],
  memberships: [{ user: 'intruder', role: 'owner' }],
};

export const otherUser: UserFixture = {
  key: 'intruder',
  id: '9f2c1a70-4d3e-4a11-9b0e-2c7d5f8a2001',
  email: 'ops@kestrelsupport.co.uk',
  displayName: 'Rowan Vance',
};

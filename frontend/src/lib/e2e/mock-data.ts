import { IdentityType } from "@/types/identity";
import type { CurrentUserAnalytics } from "@/types/analytics";
import type { LoginResult, SessionSnapshot, SignupResult } from "@/types/auth";
import type {
  ConversationStatus,
  IdentityConversationContext,
} from "@/types/conversation";
import type { Identity, IdentityTeamAccessPayload } from "@/types/identity";
import type { MyFastSharePayload, PersonaSummary } from "@/types/persona";
import type { IncomingRequest, OutgoingRequest } from "@/types/request";
import type { CurrentUserReferral, UserProfile } from "@/types/user";

export const E2E_MOCK_ACCESS_TOKEN = "dotly-e2e-token";
export const E2E_MOCK_IDENTITY_ID = "identity-e2e-primary";
export const E2E_MOCK_PERSONA_ID = "persona-e2e-primary";
const E2E_MOCK_CONVERSATION_ID = "conversation-e2e-primary";

export function createMockUserProfile(): UserProfile {
  return {
    id: "user-e2e",
    email: "ava@dotly.one",
    isVerified: true,
    security: {
      trustBadge: "verified",
      maskedEmail: "a**@dotly.one",
      mailDeliveryAvailable: true,
      passwordResetAvailable: true,
      smsDeliveryAvailable: true,
      maskedPhoneNumber: "+1 *** *** 0186",
      phoneVerificationStatus: "verified",
      mobileOtpEnrollment: null,
      explanation: "Verified and ready for QR sharing.",
      unlockedActions: [
        "create_profile_qr",
        "create_quick_connect_qr",
        "send_contact_request",
      ],
      restrictedActions: [],
      requirements: [
        {
          key: "create_profile_qr",
          label: "Create profile QR codes",
          unlocked: true,
        },
        {
          key: "create_quick_connect_qr",
          label: "Create Quick Connect QR codes",
          unlocked: true,
        },
        {
          key: "send_contact_request",
          label: "Send contact requests",
          unlocked: true,
        },
      ],
      trustFactors: [
        {
          key: "email_verified",
          label: "Email verified",
          status: "active",
          description: "Email trust is active.",
        },
        {
          key: "passkey_verified",
          label: "Passkey added",
          status: "active",
          description: "Passkey sign-in is active.",
        },
        {
          key: "mobile_otp",
          label: "Mobile OTP",
          status: "active",
          description: "Phone verification is active.",
        },
      ],
      passkeys: [
        {
          id: "passkey-e2e-1",
          name: "MacBook Touch ID",
          createdAt: "2026-03-26T09:00:00.000Z",
          updatedAt: "2026-03-27T09:30:00.000Z",
          lastUsedAt: "2026-03-27T09:30:00.000Z",
          deviceType: "multiDevice",
          backedUp: true,
        },
      ],
    },
    activation: {
      milestones: {
        firstPersonaCreatedAt: "2026-03-26T09:00:00.000Z",
        firstQrOpenedAt: "2026-03-26T09:05:00.000Z",
        firstShareCompletedAt: "2026-03-26T09:10:00.000Z",
        firstRequestReceivedAt: null,
      },
      completedCount: 3,
      nextMilestoneKey: "firstRequestReceived",
      firstResponseNudge: {
        queue: "requests",
        triggeredAt: "2026-03-27T10:00:00.000Z",
        clearedAt: null,
      },
    },
  };
}

export function createMockSessionSnapshot(): SessionSnapshot {
  return {
    user: createMockUserProfile(),
    isAuthenticated: true,
    isLoading: false,
  };
}

export function createMockLoginResult(): LoginResult {
  return {
    success: true,
    sessionId: "session-e2e",
  };
}

export function createMockSignupResult(): SignupResult {
  return {
    user: {
      id: "user-e2e",
      email: "ava@dotly.one",
      isVerified: false,
    },
    verificationPending: true,
    verificationEmailSent: true,
  };
}

export function createMockAnalytics(): CurrentUserAnalytics {
  return {
    totalConnections: 14,
    connectionsThisMonth: 5,
  };
}

export function createMockReferral(): CurrentUserReferral {
  return {
    id: "referral-e2e",
    referralCode: "AVA2026",
  };
}

export function createMockIdentities(): Identity[] {
  return [
    {
      id: E2E_MOCK_IDENTITY_ID,
      personId: "person-e2e",
      identityType: IdentityType.Professional,
      displayName: "Ava Chen",
      handle: "ava-chen",
      verificationLevel: "strong_verified",
      status: "active",
    },
  ];
}

export function createMockPersonas(): PersonaSummary[] {
  return [
    {
      id: E2E_MOCK_PERSONA_ID,
      identityId: E2E_MOCK_IDENTITY_ID,
      type: "professional",
      isPrimary: true,
      username: "ava",
      publicUrl: "/ava",
      fullName: "Ava Chen",
      jobTitle: "Founder",
      companyName: "Dotly",
      tagline: "Making introductions easier to keep.",
      websiteUrl: "https://dotly.one",
      isVerified: true,
      profilePhotoUrl: null,
      accessMode: "request",
      verifiedOnly: false,
      sharingMode: "smart_card",
      sharingConfigSource: "user_custom",
      smartCardConfig: {
        primaryAction: "instant_connect",
        allowCall: true,
        allowWhatsapp: false,
        allowEmail: true,
        allowVcard: true,
        actionState: {
          requestAccessEnabled: true,
          instantConnectEnabled: true,
          contactMeEnabled: true,
        },
      },
      sharingCapabilities: {
        hasActiveProfileQr: true,
        primaryActions: {
          requestAccess: true,
          instantConnect: true,
          contactMe: true,
        },
      },
      publicPhone: "+15550186",
      publicWhatsappNumber: null,
      publicEmail: "ava@dotly.one",
      routingKey: "founder",
      routingDisplayName: "Founder",
      isDefaultRouting: true,
      routingRulesJson: null,
      createdAt: "2026-03-20T09:00:00.000Z",
      updatedAt: "2026-03-27T09:30:00.000Z",
    },
  ];
}

export function createMockFastShare(): MyFastSharePayload {
  return {
    persona: {
      id: E2E_MOCK_PERSONA_ID,
      publicIdentifier: "ava",
      username: "ava",
      fullName: "Ava Chen",
      profilePhotoUrl: null,
    },
    share: {
      shareUrl: "https://dotly.one/ava",
      qrValue: "https://dotly.one/ava",
      primaryAction: "instant_connect",
      effectiveActions: {
        canCall: true,
        canWhatsapp: false,
        canEmail: true,
        canSaveContact: true,
      },
      preferredShareType: "smart_card",
    },
  };
}

export function createMockIncomingRequests(): IncomingRequest[] {
  return [
    {
      id: "request-incoming-e2e",
      createdAt: "2026-03-27T10:15:00.000Z",
      reason: "Would love to continue the product conversation.",
      sourceType: "qr",
      fromPersona: {
        id: "persona-incoming-e2e",
        username: "noah",
        fullName: "Noah Patel",
        jobTitle: "Design Lead",
        companyName: "Northline",
        profilePhotoUrl: null,
      },
    },
  ];
}

export function createMockOutgoingRequests(): OutgoingRequest[] {
  return [
    {
      id: "request-outgoing-e2e",
      createdAt: "2026-03-27T08:45:00.000Z",
      status: "pending",
      reason: "Follow-up after the breakfast roundtable.",
      toPersona: {
        id: "persona-outgoing-e2e",
        username: "mia",
        fullName: "Mia Rivera",
        jobTitle: "Partnerships",
        companyName: "Clearwave",
        profilePhotoUrl: null,
      },
    },
  ];
}

export function createMockTeamAccess(): IdentityTeamAccessPayload {
  return {
    identity: {
      id: E2E_MOCK_IDENTITY_ID,
      displayName: "Ava Chen",
      handle: "ava-chen",
    },
    personas: [
      {
        id: E2E_MOCK_PERSONA_ID,
        username: "ava",
        fullName: "Ava Chen",
        routingKey: "founder",
        routingDisplayName: "Founder",
        isDefaultRouting: true,
      },
    ],
    members: [
      {
        id: "member-e2e",
        personId: "person-member-e2e",
        email: "ops@dotly.one",
        role: "OWNER",
        status: "active",
        assignedPersonaIds: [E2E_MOCK_PERSONA_ID],
        assignedPersonas: [
          {
            id: E2E_MOCK_PERSONA_ID,
            username: "ava",
            fullName: "Ava Chen",
            routingKey: "founder",
            routingDisplayName: "Founder",
            isDefaultRouting: true,
          },
        ],
        accessMode: "full",
      },
    ],
    operators: [],
  };
}

export function createMockConversation(
  status: ConversationStatus = "ACTIVE" as ConversationStatus,
): IdentityConversationContext {
  return {
    conversationId: E2E_MOCK_CONVERSATION_ID,
    connectionId: "connection-e2e-primary",
    personaId: E2E_MOCK_PERSONA_ID,
    sourceIdentityId: "identity-guest-e2e",
    targetIdentityId: E2E_MOCK_IDENTITY_ID,
    conversationType:
      "INTRO" as IdentityConversationContext["conversationType"],
    conversationStatus: status,
    title: "Northline partnership follow-up",
    metadataJson: null,
    lastResolvedAt: "2026-03-27T10:18:00.000Z",
    lastPermissionHash: "mock-hash",
    createdByIdentityId: E2E_MOCK_IDENTITY_ID,
    createdAt: "2026-03-27T09:40:00.000Z",
    updatedAt: "2026-03-27T10:18:00.000Z",
  };
}

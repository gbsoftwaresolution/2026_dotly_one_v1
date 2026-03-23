import { PublicAgencyAgentCardDto } from "./public-agency-agent-card.dto";
import { PublicAgencyProfileDto } from "./public-agency-profile.dto";

export class PublicAgencyAgentsDto {
  agency!: PublicAgencyProfileDto;

  agents!: PublicAgencyAgentCardDto[];
}

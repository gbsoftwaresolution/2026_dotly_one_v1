import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Header,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";

import { VerificationDiagnosticsService } from "../auth/verification-diagnostics.service";
import { HealthService } from "./health.service";
import { HealthEndpointGuard } from "./health-endpoint.guard";
import { MetricsService } from "./metrics.service";

@Controller()
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService,
    private readonly verificationDiagnosticsService: VerificationDiagnosticsService,
  ) {}

  @Get("health")
  @HttpCode(HttpStatus.OK)
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get("health/ready")
  async getReadiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<Record<string, unknown>> {
    const readiness = await this.healthService.getReadiness();

    if (readiness.status === "down") {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return readiness;
  }

  @Get("metrics")
  @UseGuards(HealthEndpointGuard)
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  async getMetrics(): Promise<string> {
    return this.metricsService.getPrometheusSnapshot();
  }

  @Get("health/verification")
  @UseGuards(HealthEndpointGuard)
  async getVerificationDiagnostics(): Promise<Record<string, unknown>> {
    return this.verificationDiagnosticsService.getPublicRuntimeDiagnostics();
  }
}

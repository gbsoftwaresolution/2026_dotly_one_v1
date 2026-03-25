import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeviceResponse {
  sessionId!: string;
  deviceName?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  createdAt!: Date;
  lastSeenAt!: Date;
  ipAddress?: string;
  isCurrent!: boolean;

  constructor(partial: Partial<DeviceResponse>) {
    Object.assign(this, partial);
  }
}

export class RenameDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  deviceName!: string;
}

export class DevicesListResponse {
  devices!: DeviceResponse[];

  constructor(partial: Partial<DevicesListResponse>) {
    Object.assign(this, partial);
  }
}

export class RevokeDeviceResponse {
  success!: boolean;

  constructor(partial: Partial<RevokeDeviceResponse>) {
    Object.assign(this, partial);
  }
}

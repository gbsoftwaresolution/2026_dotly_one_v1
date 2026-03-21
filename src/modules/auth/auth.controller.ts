import { Body, Controller, Post } from "@nestjs/common";

import { LoginDto } from "./dto/login.dto";
import { ResendVerificationEmailDto } from "./dto/resend-verification-email.dto";
import { SignupDto } from "./dto/signup.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";

import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post("login")
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("verify-email")
  verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post("verify-email/resend")
  resendVerificationEmail(
    @Body() resendVerificationEmailDto: ResendVerificationEmailDto,
  ) {
    return this.authService.resendVerificationEmail(
      resendVerificationEmailDto,
    );
  }
}

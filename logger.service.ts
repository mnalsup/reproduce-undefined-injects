import { Injectable } from '@nestjs/common';

@Injectable()
export class LoggerService {
  private context: Record<string, any> = {};

  assign(data: Record<string, any>): void {
    this.context = { ...this.context, ...data };
  }

  log(message: string): void {
    console.log(message, this.context);
  }
}


import { Controller, Get } from '@nestjs/common';
import { User } from './user.decorator';
import { LoggerService } from './logger.service';

interface UserDto {
  id: number;
  name: string;
}

@Controller('api')
export class MyController {
  constructor(private readonly logger: LoggerService) {}

  @Get('data')
  async getData(@User() user: UserDto): Promise<any> {
    // This line will show in the error, making it seem like the issue is here
    this.logger.assign({ userId: user.id, userName: user.name });
    
    return { message: `Hello user ${user.id}` };
  }
}


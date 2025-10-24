import { createParamDecorator, ExecutionContext, Injectable, PipeTransform, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

@Injectable()
export class GetUserPipe implements PipeTransform {
  constructor(
    @Inject(REQUEST) private readonly req: any,
  ) {}

  async transform(value: any): Promise<any> {
    // Simulate getting user from request headers
    const userId = this.req.headers['x-user-id'];
    
    if (!userId) {
      return { id: 0, name: 'Anonymous' };
    }

    return { id: parseInt(userId, 10), name: 'Test User' };
  }
}

const _User = createParamDecorator(
  (data: string, ctx: ExecutionContext): string | undefined => {
    return data;
  }
);

export const User = () => _User(GetUserPipe);


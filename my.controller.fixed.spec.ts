import { Test, TestingModule } from '@nestjs/testing';
import { REQUEST } from '@nestjs/core';
import { MyController } from './my.controller';
import { LoggerService } from './logger.service';
import { GetUserPipe } from './user.decorator';

describe('MyController - WITH Proper Mocks (WORKING)', () => {
  let controller: MyController;
  let logger: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MyController],
      providers: [
        {
          provide: LoggerService,
          useValue: {
            assign: jest.fn(),
            log: jest.fn(),
          },
        },
        // Provide the pipe
        GetUserPipe,
        // FIX #1: Add REQUEST mock that GetUserPipe needs via @Inject(REQUEST)
        {
          provide: REQUEST,
          useValue: {
            headers: {
              'x-user-id': '1',
            },
          },
        },
      ],
    })
      // FIX #2: Alternative approach - override the pipe to avoid needing REQUEST at all
      .overridePipe(GetUserPipe)
      .useValue({
        transform: jest.fn().mockResolvedValue({ id: 1, name: 'Test User' }),
      })
      .compile();

    controller = module.get<MyController>(MyController);
    logger = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getData with user info', async () => {
    // This test will now work correctly!
    await controller.getData({ id: 1, name: 'Test' });

    expect(logger.assign).toHaveBeenCalledWith({
      userId: 1,
      userName: 'Test',
    });
  });
});


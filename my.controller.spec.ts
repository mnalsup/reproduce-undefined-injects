import { Test, TestingModule } from '@nestjs/testing';
import { MyController } from './my.controller';
import { LoggerService } from './logger.service';
import { GetUserPipe } from './user.decorator';
// NOTE: Missing import for REQUEST!
// This is the actual problem, but the error won't tell us that

describe('MyController - WITHOUT Proper Mocks (BROKEN)', () => {
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
        // We provide the pipe, but...
        GetUserPipe,
        // MISSING: REQUEST provider that GetUserPipe needs via @Inject(REQUEST)!
        // Without REQUEST, the pipe constructor gets 'undefined' for this.req
      ],
    }).compile();

    controller = module.get<MyController>(MyController);
    logger = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getData with user info', async () => {
    // This test will fail with a confusing error message:
    // "TypeError: Cannot read properties of undefined (reading 'headers')"
    // pointing to the @Get decorator or the logger.assign line
    // instead of telling us that REQUEST is missing!
    
    await controller.getData({ id: 1, name: 'Test' });

    expect(logger.assign).toHaveBeenCalledWith({
      userId: 1,
      userName: 'Test',
    });
  });
});


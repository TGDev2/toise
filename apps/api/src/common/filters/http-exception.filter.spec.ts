import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { AllExceptionsFilter } from './http-exception.filter';

jest.mock('@sentry/node');

function createHost(): ArgumentsHost {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new AllExceptionsFilter();
  });

  it('reporte à Sentry une exception non-HTTP (500 implicite)', () => {
    filter.catch(new Error('boom'), createHost());
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('reporte à Sentry une HttpException >= 500', () => {
    filter.catch(
      new HttpException('Oops', HttpStatus.SERVICE_UNAVAILABLE),
      createHost(),
    );
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('ne reporte pas à Sentry une HttpException < 500', () => {
    filter.catch(
      new HttpException('Bad request', HttpStatus.BAD_REQUEST),
      createHost(),
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

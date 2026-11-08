import { sign, verifySignature } from './signature';

describe('webhook signatures', () => {
  const body = JSON.stringify({ eventId: 'evt_1', type: 'order.paid', orderId: 'abc' });

  it('accepts a signature made with the same secret', () => {
    expect(verifySignature(body, sign(body, 'secret'), 'secret')).toBe(true);
  });

  it('rejects a signature made with another secret', () => {
    expect(verifySignature(body, sign(body, 'other'), 'secret')).toBe(false);
  });

  it('rejects a body changed after signing', () => {
    const signature = sign(body, 'secret');
    expect(verifySignature(body.replace('abc', 'xyz'), signature, 'secret')).toBe(false);
  });

  it('rejects signatures that are not valid hex or have the wrong length', () => {
    expect(verifySignature(body, 'not-hex', 'secret')).toBe(false);
    expect(verifySignature(body, sign(body, 'secret').slice(0, 10), 'secret')).toBe(false);
    expect(verifySignature(body, '', 'secret')).toBe(false);
  });
});

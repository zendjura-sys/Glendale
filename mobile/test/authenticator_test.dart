import 'package:flutter_test/flutter_test.dart';
import 'package:gamecon/developer.dart';

void main() {
  test('TOTP за RFC 6238 (SHA1) і розбір otpauth', () {
    // Секрет RFC: «12345678901234567890» у Base32.
    final a = TotpAccount(label: 'test', issuer: 'RFC', secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', digits: 8);
    expect(a.code(DateTime.fromMillisecondsSinceEpoch(59 * 1000)), '94287082');
    expect(a.code(DateTime.fromMillisecondsSinceEpoch(1111111109 * 1000)), '07081804');
    final parsed = TotpAccount.parse('otpauth://totp/GameCon:nick?secret=JBSWY3DPEHPK3PXP&issuer=GameCon');
    expect(parsed?.issuer, 'GameCon');
    expect(parsed?.label, 'nick');
    expect(TotpAccount.parse('https://example.com'), isNull);
  });
}

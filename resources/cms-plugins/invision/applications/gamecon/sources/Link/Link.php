<?php

namespace IPS\gamecon;

if (! \defined('\IPS\SUITE_UNIQUE_KEY')) {
    header(($_SERVER['SERVER_PROTOCOL'] ?? 'HTTP/1.0').' 403 Forbidden');
    exit;
}

/** Зв’язок учасника форуму з акаунтом GameCon. */
class _Link
{
    public static function member(array $profile)
    {
        try {
            $id = \IPS\Db::i()->select('member_id', 'gamecon_link', ['gamecon_id=?', $profile['id']])->first();

            return \IPS\Member::load($id);
        } catch (\UnderflowException $e) {
        }
        if ($profile['email'] && $profile['email_verified']) {
            $member = \IPS\Member::load($profile['email'], 'email');
            if ($member->member_id) {
                static::link($member, $profile['id']);

                return $member;
            }
        }
        $name = \GameConClient::safeUsername($profile['username'], 26);
        $base = $name;
        for ($i = 2; \IPS\Member::load($name, 'name')->member_id; $i++) {
            $name = $base.$i;
        }
        $email = $profile['email'] && ! \IPS\Member::load($profile['email'], 'email')->member_id
            ? $profile['email']
            : \GameConClient::placeholderEmail($profile, parse_url(\IPS\Settings::i()->base_url, PHP_URL_HOST));
        $member = new \IPS\Member;
        $member->name = $name;
        $member->email = $email;
        $member->member_group_id = \IPS\Settings::i()->member_group;
        $member->members_bitoptions['validating'] = false;
        $member->save();
        $member->logHistory('core', 'account', ['type' => 'register', 'service' => 'GameCon']);
        static::link($member, $profile['id']);

        return $member;
    }

    public static function link(\IPS\Member $member, $gameconId)
    {
        \IPS\Db::i()->replace('gamecon_link', ['member_id' => $member->member_id, 'gamecon_id' => (string) $gameconId]);
    }
}

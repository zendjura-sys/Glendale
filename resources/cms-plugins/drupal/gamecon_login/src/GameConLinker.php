<?php

namespace Drupal\gamecon_login;

use Drupal\user\Entity\User;
use Drupal\user\UserInterface;

/**
 * Пошук і створення акаунта Drupal за профілем GameCon (зв’язок — user.data).
 */
class GameConLinker {

  public static function findOrCreate(array $profile): UserInterface {
    $uid = \Drupal::database()->select('users_data', 'd')
      ->fields('d', ['uid'])
      ->condition('module', 'gamecon_login')
      ->condition('name', 'gamecon_id')
      ->condition('value', $profile['id'])
      ->range(0, 1)->execute()->fetchField();
    if ($uid && ($user = User::load($uid))) {
      return $user;
    }
    $storage = \Drupal::entityTypeManager()->getStorage('user');
    if ($profile['email'] && $profile['email_verified']) {
      $found = $storage->loadByProperties(['mail' => $profile['email']]);
      if ($found) {
        $user = reset($found);
        \Drupal::service('user.data')->set('gamecon_login', $user->id(), 'gamecon_id', $profile['id']);
        return $user;
      }
    }
    $name = \GameConClient::safeUsername($profile['username'], 60);
    $base = $name;
    for ($i = 2; $storage->loadByProperties(['name' => $name]); $i++) {
      $name = $base . $i;
    }
    $mail = $profile['email'] && !$storage->loadByProperties(['mail' => $profile['email']])
      ? $profile['email']
      : \GameConClient::placeholderEmail($profile, \Drupal::request()->getHost());
    $user = User::create([
      'name' => $name,
      'mail' => $mail,
      'init' => $mail,
      'pass' => \GameConClient::random(24),
      'status' => 1,
    ]);
    $user->save();
    \Drupal::service('user.data')->set('gamecon_login', $user->id(), 'gamecon_id', $profile['id']);
    return $user;
  }

}

<?php

namespace Drupal\gamecon_login\Plugin\Block;

use Drupal\Core\Block\BlockBase;
use Drupal\Core\Link;
use Drupal\Core\Url;

/**
 * Блок із кнопкою «Увійти через GameCon» (лише для гостей).
 *
 * @Block(
 *   id = "gamecon_login_block",
 *   admin_label = @Translation("Увійти через GameCon")
 * )
 */
class GameConLoginBlock extends BlockBase {

  public function build() {
    if (\Drupal::currentUser()->isAuthenticated()) {
      return ['#cache' => ['contexts' => ['user.roles:anonymous']]];
    }
    return [
      'link' => Link::fromTextAndUrl($this->t('Увійти через GameCon'), Url::fromRoute('gamecon_login.login', [], [
        'attributes' => ['class' => ['button', 'button--primary'], 'style' => 'background:#4f46e5;border-color:#4f46e5'],
      ]))->toRenderable(),
      '#cache' => ['contexts' => ['user.roles:anonymous']],
    ];
  }

}

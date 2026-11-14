<?php

namespace Drupal\gamecon_login\Form;

use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Url;

/**
 * Налаштування: Client ID, Secret, адреса GameCon.
 */
class SettingsForm extends ConfigFormBase {

  protected function getEditableConfigNames() {
    return ['gamecon_login.settings'];
  }

  public function getFormId() {
    return 'gamecon_login_settings';
  }

  public function buildForm(array $form, FormStateInterface $form_state) {
    $config = $this->config('gamecon_login.settings');
    $form['redirect'] = [
      '#type' => 'item',
      '#title' => $this->t('Адреса повернення (Redirect URI) для застосунку GameCon'),
      '#markup' => '<code>' . Url::fromRoute('gamecon_login.callback', [], ['absolute' => TRUE])->toString() . '</code>',
    ];
    $form['client_id'] = ['#type' => 'textfield', '#title' => 'Client ID', '#default_value' => $config->get('client_id'), '#required' => TRUE];
    $form['client_secret'] = ['#type' => 'textfield', '#title' => 'Client Secret', '#default_value' => $config->get('client_secret'), '#required' => TRUE];
    $form['base'] = ['#type' => 'url', '#title' => $this->t('Адреса GameCon'), '#default_value' => $config->get('base') ?: 'https://gamecon.online'];
    $form['email'] = ['#type' => 'checkbox', '#title' => $this->t('Просити доступ до email'), '#default_value' => $config->get('email')];
    return parent::buildForm($form, $form_state);
  }

  public function submitForm(array &$form, FormStateInterface $form_state) {
    $this->config('gamecon_login.settings')
      ->set('client_id', trim($form_state->getValue('client_id')))
      ->set('client_secret', trim($form_state->getValue('client_secret')))
      ->set('base', $form_state->getValue('base'))
      ->set('email', (bool) $form_state->getValue('email'))
      ->save();
    parent::submitForm($form, $form_state);
  }

}

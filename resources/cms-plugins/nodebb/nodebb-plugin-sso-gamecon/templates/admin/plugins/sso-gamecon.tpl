<div class="acp-page-container">
  <div class="row m-0">
    <div class="col-12 col-md-8 px-0 mb-4" tabindex="0">
      <h5 class="fw-bold">Увійти через GameCon</h5>
      <p class="text-muted">Створіть застосунок у розділі «Розробникам» на GameCon і вкажіть адресу повернення:<br><code>{callbackURL}</code></p>
      <form role="form" class="sso-gamecon-settings">
        <div class="mb-3"><label class="form-label" for="id">Client ID</label><input type="text" id="id" name="id" class="form-control"></div>
        <div class="mb-3"><label class="form-label" for="secret">Client Secret</label><input type="password" id="secret" name="secret" class="form-control" autocomplete="off"></div>
        <div class="mb-3"><label class="form-label" for="base">Адреса GameCon</label><input type="url" id="base" name="base" class="form-control" placeholder="https://gamecon.online"></div>
      </form>
      <p class="text-muted">Після збереження перезапустіть NodeBB.</p>
      <button id="save" class="btn btn-primary">Зберегти</button>
    </div>
  </div>
</div>

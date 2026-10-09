<?php

namespace App\Http\Requests\Settings;

use App\Concerns\ProfileValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ProfileUpdateRequest extends FormRequest
{
    use ProfileValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...$this->profileRules($this->user()->id),
            ...$this->aboutRules($this->user()->id),
            'email_social' => ['sometimes', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['is_private' => $this->boolean('is_private')]);
        // Застосунок і старі форми поля не надсилають — тоді налаштування лишається як було.
        if ($this->has('email_social')) {
            $this->merge(['email_social' => $this->boolean('email_social')]);
        }
    }
}

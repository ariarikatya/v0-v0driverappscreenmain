"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserPlus, Upload, X, Eye, EyeOff } from "lucide-react"
import type { Language } from "@/lib/translations"
import { translations } from "@/lib/translations"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface RegisterFormProps {
  onRegister: () => void
  onBackToLogin: () => void
  language: Language
}

export function RegisterForm({ onRegister, onBackToLogin, language }: RegisterFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [city, setCity] = useState("")
  const [carNumber, setCarNumber] = useState("")
  const [phone, setPhone] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true)
  const [documents, setDocuments] = useState<File[]>([])
  const t = translations[language]

  const isFormValid = email && password && city && carNumber && phone && documents.length > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Mock registration
    if (isFormValid) {
      console.log("[v0] Registration successful, navigating to driver screen")
      onRegister()
    } else {
      alert(language === "ru" ? "Заполните все обязательные поля (*)" : "Fill all required fields (*)")
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocuments([...documents, ...Array.from(e.target.files)])
    }
  }

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index))
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <UserPlus className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{t.registration}</h1>
          <p className="text-sm text-muted-foreground">{t.createAccount}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t.email} *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t.password} *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-12 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-12 w-12"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">{t.city} *</Label>
            <Select value={city} onValueChange={setCity} required>
              <SelectTrigger className="h-12">
                <SelectValue placeholder={language === "ru" ? "Выберите город" : "Select city"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="moscow">{language === "ru" ? "Москва" : "Moscow"}</SelectItem>
                <SelectItem value="spb">{language === "ru" ? "Санкт-Петербург" : "Saint Petersburg"}</SelectItem>
                <SelectItem value="kazan">{language === "ru" ? "Казань" : "Kazan"}</SelectItem>
                <SelectItem value="novosibirsk">{language === "ru" ? "Новосибирск" : "Novosibirsk"}</SelectItem>
                <SelectItem value="ekb">{language === "ru" ? "Екатеринбург" : "Yekaterinburg"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{language === "ru" ? "Номер телефона" : "Phone Number"} *</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                if (whatsappSameAsPhone) {
                  setWhatsapp(e.target.value)
                }
              }}
              placeholder="+7 900 123-45-67"
              required
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="whatsapp-same"
                checked={whatsappSameAsPhone}
                onCheckedChange={(checked) => {
                  setWhatsappSameAsPhone(checked as boolean)
                  if (checked) {
                    setWhatsapp(phone)
                  }
                }}
              />
              <Label htmlFor="whatsapp-same" className="text-sm font-normal cursor-pointer">
                {language === "ru" ? "WhatsApp совпадает с телефоном" : "WhatsApp same as phone"}
              </Label>
            </div>
            {!whatsappSameAsPhone && (
              <>
                <Label htmlFor="whatsapp">{language === "ru" ? "Номер WhatsApp" : "WhatsApp Number"}</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+7 900 123-45-67"
                  className="h-12"
                />
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="carNumber">{t.carNumber} *</Label>
            <Input
              id="carNumber"
              type="text"
              value={carNumber}
              onChange={(e) => setCarNumber(e.target.value)}
              placeholder={language === "ru" ? "А123БВ777" : "A123BC777"}
              required
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="documents">{t.idDocument} *</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  {language === "ru" ? "Загрузите документы" : "Upload documents"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === "ru" ? "Удостоверение личности, права, лицензия" : "ID, license, permits"}
                </p>
                <Input
                  id="documents"
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("documents")?.click()}
                >
                  {language === "ru" ? "Выбрать файлы" : "Choose files"}
                </Button>
              </div>

              {documents.length > 0 && (
                <div className="mt-4 space-y-2">
                  {documents.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-secondary rounded">
                      <span className="text-sm truncate flex-1">{doc.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeDocument(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={!isFormValid}>
            {t.register}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Button type="button" variant="link" onClick={onBackToLogin} className="text-sm">
            {language === "ru" ? "Уже есть аккаунт? Войти" : "Already have an account? Sign in"}
          </Button>
        </div>
      </Card>
    </div>
  )
}

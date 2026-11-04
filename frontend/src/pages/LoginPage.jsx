import { useEffect, useState } from 'react'
import { App, Button, Form, Input, Tabs } from 'antd'
import { navigate, useLocation } from '../lib/router'
import { useAuth } from '../context/AuthContext'
import { blurValidation } from '../lib/forms'
import { LOGO } from '../lib/api'

export default function LoginPage() {
  const { message } = App.useApp()
  const { user, login, register } = useAuth()
  const { search } = useLocation()
  const [loading, setLoading] = useState(false)
  const [loginForm] = Form.useForm()
  const [registerForm] = Form.useForm()
  const nextParam = search.get('next')
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null

  useEffect(() => {
    if (user) navigate(next || (user.rol === 'admin' ? '/admin' : '/mi-cuenta'), { replace: true })
  }, [user, next])

  const run = (fn, ok) => async (values) => {
    setLoading(true)
    try {
      await fn(values)
      message.success(ok)
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loginView = (
    <Form form={loginForm} {...blurValidation(loginForm)} name="login" layout="vertical" requiredMark={false} onFinish={run((v) => login(v.email, v.password), '¡Hola de nuevo!')}>
      <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Ingresá tu email' }]}>
        <Input autoComplete="email" />
      </Form.Item>
      <Form.Item name="password" label="Contraseña" rules={[{ required: true, message: 'Ingresá tu contraseña' }]}>
        <Input.Password autoComplete="current-password" />
      </Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={loading}>
        Ingresar
      </Button>
    </Form>
  )

  const registerView = (
    <Form form={registerForm} {...blurValidation(registerForm)} name="registro" layout="vertical" requiredMark={false} onFinish={run(register, '¡Bienvenido/a a Rascate Art!')}>
      <Form.Item name="nombre" label="Nombre y apellido" rules={[{ required: true, min: 2, message: 'Ingresá tu nombre' }]}>
        <Input autoComplete="name" />
      </Form.Item>
      <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Ingresá un email válido' }]}>
        <Input autoComplete="email" />
      </Form.Item>
      <Form.Item name="password" label="Contraseña" rules={[{ required: true, min: 6, message: 'Mínimo 6 caracteres' }]}>
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Form.Item name="telefono" label="Teléfono / WhatsApp (opcional)">
        <Input autoComplete="tel" />
      </Form.Item>
      <Form.Item name="direccion" label="Dirección (opcional)">
        <Input autoComplete="street-address" />
      </Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={loading}>
        Crear cuenta
      </Button>
    </Form>
  )

  return (
    <div className="container auth-page">
      <div className="panel auth-card">
        <img src={LOGO} alt="" width="72" height="72" className="auth-logo" />
        <Tabs
          centered
          items={[
            { key: 'login', label: 'Ingresar', children: loginView },
            { key: 'registro', label: 'Crear cuenta', children: registerView },
          ]}
        />
      </div>
    </div>
  )
}

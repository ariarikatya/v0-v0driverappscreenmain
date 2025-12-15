// API клиент для работы с методами заказчика

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.example.com'

// Тестовые учётные данные
export const TEST_CREDENTIALS = {
  email: 'driver@test.com',
  password: 'driver123',
}

export interface AccountBalance {
  balance: number
  reserved: number
  currency: string
}

export interface Transaction {
  id: string
  amount: number
  amountPaid?: number
  amountRemaining?: number
  type: 'deposit' | 'withdraw' | 'payment'
  status: 'completed' | 'pending' | 'failed'
  paymentMethod?: 'cash' | 'card'
  createdAt: string
  description?: string
}

export interface Deal {
  id: string
  bookingId: number
  status: 'created' | 'confirmed' | 'completed' | 'cancelled'
  amount: number
  currency: string
  createdAt: string
}

// Mock API responses для демонстрации
export const apiClient = {
  // Получение баланса водителя
  async getAccount(): Promise<AccountBalance> {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('[v0] API: account/get called')
    
    return {
      balance: 15430.50,
      reserved: 2100.00,
      currency: 'RUB',
    }
  },

  // Получение транзакций (для статуса оплаты)
  async getTransactions(): Promise<Transaction[]> {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('[v0] API: account/transaction called')
    
    return [
      {
        id: 'txn_001',
        amount: 350.00,
        amountPaid: 350.00,
        amountRemaining: 0,
        type: 'payment',
        status: 'completed',
        paymentMethod: 'card',
        createdAt: new Date().toISOString(),
        description: 'Бронирование #1',
      },
      {
        id: 'txn_002',
        amount: 420.00,
        amountPaid: 0,
        amountRemaining: 420.00,
        type: 'payment',
        status: 'pending',
        paymentMethod: 'cash',
        createdAt: new Date().toISOString(),
        description: 'Бронирование #2',
      },
      {
        id: 'txn_003',
        amount: 380.00,
        amountPaid: 200.00,
        amountRemaining: 180.00,
        type: 'payment',
        status: 'pending',
        paymentMethod: 'card',
        createdAt: new Date().toISOString(),
        description: 'Бронирование #3',
      },
    ]
  },

  // Создание сделки
  async createDeal(bookingId: number, amount: number): Promise<Deal> {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('[v0] API: deal/create called for booking', bookingId)
    
    return {
      id: `deal_${Date.now()}`,
      bookingId,
      status: 'created',
      amount,
      currency: 'RUB',
      createdAt: new Date().toISOString(),
    }
  },

  // Подтверждение сделки
  async confirmDeal(dealId: string): Promise<Deal> {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('[v0] API: deal/confirm called for deal', dealId)
    
    return {
      id: dealId,
      bookingId: 0,
      status: 'confirmed',
      amount: 0,
      currency: 'RUB',
      createdAt: new Date().toISOString(),
    }
  },

  // Завершение сделки
  async completeDeal(dealId: string): Promise<Deal> {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('[v0] API: deal/complete called for deal', dealId)
    
    return {
      id: dealId,
      bookingId: 0,
      status: 'completed',
      amount: 0,
      currency: 'RUB',
      createdAt: new Date().toISOString(),
    }
  },

  // Пополнение баланса
  async depositBalance(amount: number): Promise<Transaction> {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('[v0] API: account/deposit called with amount', amount)
    
    return {
      id: `txn_${Date.now()}`,
      amount,
      type: 'deposit',
      status: 'completed',
      createdAt: new Date().toISOString(),
      description: 'Пополнение баланса',
    }
  },

  // Списание со счёта
  async withdrawBalance(amount: number): Promise<Transaction> {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('[v0] API: account/withdraw called with amount', amount)
    
    return {
      id: `txn_${Date.now()}`,
      amount,
      type: 'withdraw',
      status: 'completed',
      createdAt: new Date().toISOString(),
      description: 'Списание со счёта',
    }
  },

  // Получение транзакции для конкретного бронирования
  async getTransaction(bookingId: number): Promise<Transaction> {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('[v0] API: account/transaction called for booking', bookingId)
    
    // Mock данные с различными статусами оплаты
    const mockTransactions: Record<number, Transaction> = {
      1: {
        id: 'txn_001',
        amount: 350.00,
        amountPaid: 350.00,
        amountRemaining: 0,
        type: 'payment',
        status: 'completed',
        paymentMethod: 'card',
        createdAt: new Date().toISOString(),
        description: 'Бронирование #1',
      },
      2: {
        id: 'txn_002',
        amount: 420.00,
        amountPaid: 0,
        amountRemaining: 420.00,
        type: 'payment',
        status: 'pending',
        paymentMethod: 'cash',
        createdAt: new Date().toISOString(),
        description: 'Бронирование #2',
      },
      3: {
        id: 'txn_003',
        amount: 380.00,
        amountPaid: 200.00,
        amountRemaining: 180.00,
        type: 'payment',
        status: 'pending',
        paymentMethod: 'card',
        createdAt: new Date().toISOString(),
        description: 'Бронирование #3',
      },
    }
    
    return mockTransactions[bookingId] || {
      id: `txn_${bookingId}`,
      amount: 350.00,
      amountPaid: 0,
      amountRemaining: 350.00,
      type: 'payment',
      status: 'pending',
      createdAt: new Date().toISOString(),
      description: `Бронирование #${bookingId}`,
    }
  },
}

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import type { WizardData } from './RaidWizard'

const schema = z.object({
  title: z.string().min(2, 'Nome obrigatório'),
  date: z.string().min(1, 'Data obrigatória'),
  origin: z.string().min(1, 'Ponto de partida obrigatório'),
  destination: z.string().min(1, 'Destino obrigatório'),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  estimatedKm: z.coerce.number().optional(),
  estimatedDuration: z.string().optional(),
  description: z.string().optional(),
  maxSpeed: z.coerce.number().int().optional(),
  communicationChannel: z.string().optional(),
  accommodation: z.string().optional(),
  accommodationContact: z.string().optional(),
  roadTypes: z.array(z.string()).optional(),
})
type FormData = z.infer<typeof schema>

const ROAD_TYPES = ['Asfalto', 'Terra', 'Misto', 'Off-road']

interface Props {
  data: Partial<WizardData>
  defaultSettings: any
  onNext: (updates: Partial<WizardData>) => void
}

export default function Step1Basics({ data, defaultSettings, onNext }: Props) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: data.title ?? '',
      date: data.date ?? '',
      origin: data.origin ?? '',
      destination: data.destination ?? '',
      difficulty: (data.difficulty as any) ?? 'MEDIUM',
      estimatedKm: data.estimatedKm,
      estimatedDuration: data.estimatedDuration ?? '',
      description: data.description ?? '',
      maxSpeed: data.maxSpeed ?? defaultSettings?.maxSpeed ?? 90,
      communicationChannel: data.communicationChannel ?? defaultSettings?.radioChannel ?? 'PMR446 Canal 6',
      accommodation: data.accommodation ?? '',
      accommodationContact: data.accommodationContact ?? '',
      roadTypes: data.roadTypes ?? [],
    },
  })

  const roadTypes = watch('roadTypes') ?? []

  function toggleRoadType(type: string) {
    const current = roadTypes
    const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type]
    setValue('roadTypes', next)
  }

  return (
    <form onSubmit={handleSubmit((d) => onNext(d))} className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <h3 className="font-semibold text-gray-900">Informação Principal</h3>

          <Input label="Nome do raid *" placeholder="Rota do Douro 2025" error={errors.title?.message} {...register('title')} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Data de saída *" type="date" error={errors.date?.message} {...register('date')} />
            <Select
              label="Dificuldade"
              options={[
                { value: 'EASY', label: 'Fácil' },
                { value: 'MEDIUM', label: 'Médio' },
                { value: 'HARD', label: 'Difícil' },
              ]}
              {...register('difficulty')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Ponto de partida *" placeholder="Luanda, Maianga" error={errors.origin?.message} {...register('origin')} />
            <Input label="Destino *" placeholder="Benguela, Cidade Alta" error={errors.destination?.message} {...register('destination')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Distância (km)" type="number" placeholder="350" {...register('estimatedKm')} />
            <Input label="Duração" placeholder="1 dia" {...register('estimatedDuration')} />
          </div>

          <Textarea label="Descrição / Notas gerais" placeholder="Informação adicional sobre o raid..." rows={3} {...register('description')} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <h3 className="font-semibold text-gray-900">Tipo de Estrada</h3>
          <div className="flex gap-2 flex-wrap">
            {ROAD_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => toggleRoadType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  roadTypes.includes(type)
                    ? 'text-white border-transparent'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
                style={roadTypes.includes(type) ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
              >
                {type}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <h3 className="font-semibold text-gray-900">Configurações do Raid</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Vel. máxima em comboio (km/h)" type="number" placeholder="90" {...register('maxSpeed')} />
            <Input label="Canal de rádio" placeholder="PMR446 Canal 6" {...register('communicationChannel')} />
            <Input label="Alojamento (se aplicável)" placeholder="Hotel Trópico, Luanda" {...register('accommodation')} />
            <Input label="Contacto do alojamento" placeholder="222 000 000" {...register('accommodationContact')} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">Próximo: Roteiro →</Button>
      </div>
    </form>
  )
}

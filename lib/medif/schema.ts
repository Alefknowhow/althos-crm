/**
 * Estrutura de campos do MEDIF (Medical Information Form) — espelha as 7
 * páginas do formulário oficial da operadora/companhia aérea (ex.: Azul,
 * IATA Resolução 700, Anexos A e B). É a fonte única usada pelo
 * `MedifForm.tsx` pra renderizar o formulário dinamicamente e pelo
 * registro salvo em `medif_records.data` (um valor por `key`).
 *
 * O PDF oficial em si (que precisa de assinatura física do médico e do
 * passageiro) não é gerado a partir daqui — só disponibilizado para
 * download como modelo em branco. Este formulário serve pra manter um
 * registro digital consultável no CRM.
 */

export type MedifFieldType = 'text' | 'textarea' | 'date' | 'yesno' | 'select' | 'number'

export type MedifField = {
  key: string
  label: string
  type: MedifFieldType
  options?: string[]
  helper?: string
}

export type MedifSection = {
  key: string
  title: string
  fields: MedifField[]
}

const YESNO: MedifFieldType = 'yesno'

export const MEDIF_SECTIONS: MedifSection[] = [
  {
    key: 'passageiro',
    title: 'Identificação do passageiro (Anexo A)',
    fields: [
      { key: 'passageiro_nome', label: 'Nome', type: 'text' },
      { key: 'passageiro_telefone', label: 'Telefone', type: 'text' },
      { key: 'passageiro_idade', label: 'Idade', type: 'number' },
      { key: 'passageiro_data_nascimento', label: 'Data de nascimento', type: 'date' },
      { key: 'passageiro_peso', label: 'Peso', type: 'text' },
      { key: 'passageiro_altura', label: 'Altura', type: 'text' },
    ],
  },
  {
    key: 'itinerario',
    title: 'Itinerário',
    fields: [
      { key: 'voo1_numero', label: 'Voo 1 — N. voo', type: 'text' },
      { key: 'voo1_data', label: 'Voo 1 — Data', type: 'date' },
      { key: 'voo1_origem', label: 'Voo 1 — Origem', type: 'text' },
      { key: 'voo1_destino', label: 'Voo 1 — Destino', type: 'text' },
      { key: 'voo2_numero', label: 'Voo 2 — N. voo', type: 'text' },
      { key: 'voo2_data', label: 'Voo 2 — Data', type: 'date' },
      { key: 'voo2_origem', label: 'Voo 2 — Origem', type: 'text' },
      { key: 'voo2_destino', label: 'Voo 2 — Destino', type: 'text' },
      { key: 'voo3_numero', label: 'Voo 3 — N. voo', type: 'text' },
      { key: 'voo3_data', label: 'Voo 3 — Data', type: 'date' },
      { key: 'voo3_origem', label: 'Voo 3 — Origem', type: 'text' },
      { key: 'voo3_destino', label: 'Voo 3 — Destino', type: 'text' },
      { key: 'voo4_numero', label: 'Voo 4 — N. voo', type: 'text' },
      { key: 'voo4_data', label: 'Voo 4 — Data', type: 'date' },
      { key: 'voo4_origem', label: 'Voo 4 — Origem', type: 'text' },
      { key: 'voo4_destino', label: 'Voo 4 — Destino', type: 'text' },
    ],
  },
  {
    key: 'necessidades_especiais',
    title: 'Necessidades especiais',
    fields: [
      { key: 'acompanhante_enfermidade', label: 'Acompanhante em virtude da enfermidade', type: YESNO },
      { key: 'nome_acompanhante', label: 'Nome do acompanhante', type: 'text' },
      { key: 'maca_bordo', label: 'Maca a bordo', type: YESNO },
      { key: 'cadeira_rodas', label: 'Cadeira de rodas', type: YESNO },
      { key: 'cadeira_propria', label: 'Cadeira própria', type: YESNO },
      { key: 'cadeira_motorizada', label: 'Cadeira motorizada', type: YESNO },
      { key: 'bateria_liquida', label: 'Bateria líquida', type: YESNO },
      { key: 'oxigenio_bordo', label: 'Oxigênio a bordo', type: YESNO },
      { key: 'tem_concentrador_proprio', label: 'Tem concentrador próprio', type: YESNO },
      { key: 'litros_minuto_bordo', label: 'Litros/minuto', type: 'text' },
      { key: 'ambulancia', label: 'Ambulância', type: YESNO },
      { key: 'ja_contratou_ambulancia', label: 'Já contratou ambulância', type: YESNO },
      { key: 'extensor_cinto', label: 'Extensor de cinto', type: YESNO },
      { key: 'comida_especial', label: 'Comida especial', type: YESNO },
      { key: 'tipo_comida_especial', label: 'Tipo de comida especial', type: 'text' },
      { key: 'outras_necessidades_solo', label: 'Outras necessidades em solo', type: 'textarea' },
      { key: 'outras_necessidades_bordo', label: 'Outras necessidades a bordo', type: 'textarea' },
    ],
  },
  {
    key: 'declaracao_passageiro',
    title: 'Declaração do passageiro ou responsável',
    fields: [
      { key: 'medico_nomeado_crm', label: 'Médico nomeado (nome e CRM-UF)', type: 'text' },
      { key: 'declaracao_local', label: 'Local', type: 'text' },
      { key: 'declaracao_data', label: 'Data', type: 'date' },
      { key: 'declaracao_cpf_passaporte', label: 'CPF, passaporte ou RNE', type: 'text' },
    ],
  },
  {
    key: 'identificacao_medico',
    title: 'Identificação do paciente e do médico (Anexo B parte I)',
    fields: [
      { key: 'paciente_nome', label: 'Nome do paciente', type: 'text' },
      { key: 'paciente_idade', label: 'Idade', type: 'number' },
      { key: 'paciente_data_nascimento', label: 'Data de nascimento', type: 'date' },
      { key: 'paciente_peso', label: 'Peso', type: 'text' },
      { key: 'paciente_altura', label: 'Altura', type: 'text' },
      { key: 'paciente_sexo', label: 'Sexo', type: 'text' },
      { key: 'medico_nome', label: 'Nome do médico', type: 'text' },
      { key: 'medico_crm_estado', label: 'CRM e Estado', type: 'text' },
      { key: 'medico_telefone', label: 'Telefone (com DDD)', type: 'text' },
      { key: 'medico_email', label: 'E-mail', type: 'text' },
      { key: 'medico_especialidade', label: 'Especialidade', type: 'text' },
      { key: 'medico_rqe', label: 'RQE', type: 'text' },
      { key: 'medico_data_preenchimento', label: 'Data do preenchimento', type: 'date' },
    ],
  },
  {
    key: 'diagnostico_sinais_vitais',
    title: 'Diagnóstico e sinais vitais',
    fields: [
      { key: 'diagnostico', label: 'Diagnóstico', type: 'textarea' },
      { key: 'diagnostico_data_inicio', label: 'Data de início', type: 'date' },
      { key: 'evolucao_clinica', label: 'Evolução clínica', type: 'textarea' },
      { key: 'comorbidades', label: 'Comorbidades', type: 'textarea' },
      { key: 'tratamentos_medicacoes', label: 'Tratamentos e medicações em uso', type: 'textarea' },
      { key: 'prognostico', label: 'Prognóstico', type: 'textarea' },
      { key: 'cid', label: 'CID', type: 'text' },
      {
        key: 'hipoxia_relativa_afeta', label: 'Redução de 25-30% na pressão parcial de O2 pode afetar o paciente?',
        type: 'select', options: ['Sim', 'Não', 'Não tenho certeza'],
      },
      { key: 'pressao_arterial', label: 'Pressão arterial (mmHg)', type: 'text' },
      { key: 'frequencia_cardiaca', label: 'Frequência cardíaca (BPM)', type: 'text' },
      { key: 'frequencia_respiratoria', label: 'Frequência respiratória (IPM)', type: 'text' },
      { key: 'temperatura', label: 'Temperatura (°C)', type: 'text' },
      { key: 'saturacao_oxigenio', label: 'Saturação de oxigênio (%)', type: 'text' },
      { key: 'ar_ambiente_ou_o2', label: 'Ar ambiente ou O2 suplementar', type: 'select', options: ['Ar ambiente', 'O2 suplementar'] },
    ],
  },
  {
    key: 'clinicas_adicionais',
    title: 'Informações clínicas adicionais',
    fields: [
      { key: 'anemia', label: 'Anemia', type: YESNO },
      { key: 'hemoglobina', label: 'Hemoglobina', type: 'text' },
      { key: 'hemoglobina_data', label: 'Data (hemoglobina)', type: 'date' },
      { key: 'transtorno_psiquiatrico', label: 'Transtorno psiquiátrico', type: YESNO },
      { key: 'transtorno_psiquiatrico_qual', label: 'Qual (transtorno psiquiátrico)', type: 'text' },
      { key: 'convulsoes_flag', label: 'Convulsões', type: YESNO },
      { key: 'doenca_cardiovascular', label: 'Doença cardiovascular', type: YESNO },
      { key: 'doenca_cardiovascular_qual', label: 'Qual (cardiovascular)', type: 'text' },
      { key: 'doenca_respiratoria', label: 'Doença respiratória', type: YESNO },
      { key: 'doenca_respiratoria_qual', label: 'Qual (respiratória)', type: 'text' },
      { key: 'doenca_contagiosa', label: 'Portador de doença contagiosa/transmissível', type: YESNO },
      { key: 'doenca_contagiosa_qual', label: 'Qual (contagiosa)', type: 'text' },
      { key: 'cirurgia_recente', label: 'Cirurgia recente', type: YESNO },
      { key: 'cirurgia_recente_qual_data', label: 'Qual cirurgia e data', type: 'text' },
      { key: 'controle_vesical_normal', label: 'Controle vesical normal', type: YESNO },
      { key: 'controle_vesical_obs', label: 'Se não, especificar', type: 'text' },
      { key: 'controle_intestinal_normal', label: 'Controle intestinal normal', type: YESNO },
      { key: 'controle_intestinal_obs', label: 'Se não, especificar', type: 'text' },
      { key: 'imobilizacao', label: 'Imobilização', type: YESNO },
      { key: 'imobilizacao_tipo_data', label: 'Se sim, tipo e data', type: 'text' },
      { key: 'oxigenio_em_casa', label: 'Paciente faz uso de oxigênio em casa', type: YESNO },
      { key: 'oxigenio_em_casa_lmin', label: 'Se sim, L/min', type: 'text' },
      { key: 'necessidade_oxigenio_bordo', label: 'Necessidade de oxigênio a bordo', type: YESNO },
      { key: 'necessidade_oxigenio_bordo_lmin', label: 'Se sim, L/min', type: 'text' },
    ],
  },
  {
    key: 'mobilidade',
    title: 'Mobilidade',
    fields: [
      { key: 'cadeira_rodas_embarque', label: 'É necessário cadeira de rodas para embarque', type: YESNO },
      {
        key: 'tipo_cadeira', label: 'Tipo de cadeira', type: 'select',
        options: ['WCHR (sobe escadas e caminha na cabine)', 'WCHS (não sobe escadas, mas caminha na cabine)', 'WCHC (não sobe escadas e não caminha na cabine)'],
      },
      { key: 'assento_vertical', label: 'Pode usar o assento na posição vertical quando necessário', type: YESNO },
      { key: 'joelhos_dobrados', label: 'Pode ficar sentado com os joelhos dobrados', type: YESNO },
      { key: 'maca_bordo_necessaria', label: 'Necessita de maca a bordo', type: YESNO },
    ],
  },
  {
    key: 'gestante',
    title: 'Gestante',
    fields: [
      { key: 'gestante_dum', label: 'Data da última menstruação', type: 'date' },
      { key: 'gestante_g', label: 'G', type: 'text' },
      { key: 'gestante_p', label: 'P', type: 'text' },
      { key: 'gestante_a', label: 'A', type: 'text' },
      { key: 'gestacao_tipo', label: 'Tipo de gestação', type: 'select', options: ['Única', 'Gemelar'] },
      { key: 'gestacao_risco', label: 'Risco', type: 'select', options: ['Baixo risco', 'Alto risco'] },
      { key: 'idade_gestacional_atual', label: 'Idade gestacional atual', type: 'text' },
      { key: 'idade_gestacional_viagem', label: 'Idade gestacional na data da viagem', type: 'text' },
      { key: 'data_provavel_parto', label: 'Data provável do parto', type: 'date' },
    ],
  },
  {
    key: 'medicamentos',
    title: 'Medicamentos e outras informações',
    fields: [
      { key: 'lista_medicamentos', label: 'Lista de medicamentos em uso', type: 'textarea' },
      { key: 'outras_informacoes_medicas', label: 'Outras informações médicas', type: 'textarea' },
      { key: 'parte1_local', label: 'Local', type: 'text' },
      { key: 'parte1_data', label: 'Data', type: 'date' },
    ],
  },
  {
    key: 'condicao_cardiaca',
    title: 'Condição cardíaca (Anexo B parte II)',
    fields: [
      { key: 'angina', label: 'Angina', type: YESNO },
      { key: 'angina_ultimo_episodio', label: 'Último episódio (angina)', type: 'date' },
      { key: 'angina_condicao_estavel', label: 'Condição estável', type: YESNO },
      {
        key: 'angina_classe_funcional', label: 'Classe funcional (angina)', type: 'select',
        options: ['Sem sintomas', 'Angina aos grandes esforços', 'Angina aos pequenos esforços', 'Angina em repouso'],
      },
      { key: 'anda_100m_cardiaco', label: 'Anda 100m ou sobe 12 degraus sem sintomas', type: YESNO },
      { key: 'infarto_miocardio', label: 'Infarto do miocárdio', type: YESNO },
      { key: 'infarto_miocardio_data', label: 'Data (infarto)', type: 'date' },
      { key: 'infarto_complicacoes', label: 'Complicações', type: YESNO },
      { key: 'infarto_complicacoes_quais', label: 'Quais complicações', type: 'text' },
      { key: 'ecg_esforco_realizado', label: 'ECG de esforço realizado', type: YESNO },
      { key: 'ecg_esforco_resultado', label: 'Resultado (ECG)', type: 'text' },
      { key: 'angioplastia_anda_100m', label: 'Se angioplastia/ponte, anda 100m ou sobe 12 degraus sem sintomas', type: YESNO },
      { key: 'insuficiencia_cardiaca', label: 'Insuficiência cardíaca', type: YESNO },
      { key: 'insuficiencia_cardiaca_ultimo_episodio', label: 'Data do último episódio', type: 'date' },
      { key: 'ic_controlado_medicacao', label: 'Controlado com medicação', type: YESNO },
      {
        key: 'ic_classe_funcional', label: 'Classe funcional (IC)', type: 'select',
        options: ['Sem sintomas', 'Dispneia aos grandes esforços', 'Dispneia aos pequenos esforços', 'Dispneia em repouso'],
      },
      { key: 'sincope', label: 'Síncope', type: YESNO },
      { key: 'sincope_ultimo_episodio', label: 'Último episódio (síncope)', type: 'date' },
      { key: 'sincope_investigacao', label: 'Investigação realizada', type: YESNO },
      { key: 'sincope_investigacao_resultados', label: 'Resultados da investigação', type: 'text' },
    ],
  },
  {
    key: 'condicao_pulmonar',
    title: 'Condição pulmonar',
    fields: [
      { key: 'doenca_pulmonar_cronica', label: 'Doença pulmonar crônica', type: YESNO },
      { key: 'gasometria_recente', label: 'Gasometria arterial recente', type: YESNO },
      { key: 'gasometria_data', label: 'Data (gasometria)', type: 'date' },
      { key: 'gasometria_ar_ou_oxigenio', label: 'Ar ambiente ou oxigênio (na gasometria)', type: 'select', options: ['Ar ambiente', 'Oxigênio'] },
      { key: 'gasometria_litros_min', label: 'Litros/min', type: 'text' },
      { key: 'gasometria_po2', label: 'pO2', type: 'text' },
      { key: 'gasometria_pco2', label: 'pCO2', type: 'text' },
      { key: 'gasometria_saturacao', label: 'Saturação', type: 'text' },
      { key: 'retem_co2', label: 'Paciente retém CO2', type: YESNO },
      { key: 'piora_recente', label: 'Condição apresentou piora recente', type: YESNO },
      { key: 'anda_100m_pulmonar', label: 'Anda 100m ou sobe 12 degraus sem sintomas', type: YESNO },
      { key: 'ja_viajou_condicoes', label: 'Já viajou nessas condições em avião comercial', type: YESNO },
      { key: 'ja_viajou_quando', label: 'Se sim, quando', type: 'text' },
      { key: 'ja_viajou_duracao_voo', label: 'Duração do voo', type: 'text' },
      { key: 'teve_problemas_viagem', label: 'Teve problemas durante a viagem', type: YESNO },
    ],
  },
  {
    key: 'psiquiatrica_convulsoes',
    title: 'Condição psiquiátrica, convulsões e prognóstico',
    fields: [
      { key: 'doenca_psiquiatrica_flag', label: 'Doença psiquiátrica', type: YESNO },
      { key: 'doenca_psiquiatrica_qual', label: 'Qual (psiquiátrica)', type: 'text' },
      { key: 'possibilidade_agitacao', label: 'Possibilidade de agitação durante o voo', type: YESNO },
      { key: 'ja_viajou_aviao_antes', label: 'Já viajou em avião comercial antes', type: YESNO },
      { key: 'ja_viajou_aviao_data', label: 'Se sim, data', type: 'date' },
      { key: 'ja_viajou_sozinho_ou_acompanhado', label: 'Sozinho ou acompanhado', type: 'select', options: ['Sozinho', 'Acompanhado'] },
      { key: 'ja_teve_convulsao', label: 'Já teve convulsão', type: YESNO },
      { key: 'tipo_crise', label: 'Tipo de crise', type: 'text' },
      { key: 'frequencia_convulsoes', label: 'Frequência das convulsões', type: 'text' },
      { key: 'data_ultima_crise', label: 'Data da última crise', type: 'date' },
      { key: 'prognostico_viagem_aerea', label: 'Prognóstico para viagem aérea', type: 'textarea' },
      { key: 'parte2_local', label: 'Local', type: 'text' },
      { key: 'parte2_data', label: 'Data', type: 'date' },
    ],
  },
  {
    key: 'pnae_acompanhante',
    title: 'Declaração médica de necessidade de acompanhante (PNAE)',
    fields: [
      { key: 'pnae_medico_nome', label: 'Nome do médico', type: 'text' },
      { key: 'pnae_medico_crm_estado', label: 'CRM/Estado', type: 'text' },
      { key: 'pnae_medico_cpf', label: 'CPF do médico', type: 'text' },
      { key: 'pnae_paciente_cpf', label: 'CPF do paciente', type: 'text' },
      { key: 'pnae_diagnostico', label: 'Diagnóstico', type: 'text' },
      { key: 'pnae_cid', label: 'CID', type: 'text' },
      { key: 'pnae_necessita_maca_incubadora', label: 'Necessita viajar em maca ou incubadora', type: YESNO },
      { key: 'pnae_impedimento_mental', label: 'Impedimento mental/intelectual/sensorial para compreender instruções de segurança', type: YESNO },
      { key: 'pnae_impedimento_mental_detalhe', label: 'Detalhamento (impedimento)', type: 'textarea' },
      { key: 'pnae_atende_fisiologicas_sozinho', label: 'Atende às necessidades fisiológicas sem assistência', type: YESNO },
      { key: 'pnae_limitacao_alimentar', label: 'Limitação para se alimentar sozinho', type: YESNO },
      { key: 'pnae_limitacao_alimentar_detalhe', label: 'Detalhamento (alimentação)', type: 'textarea' },
      { key: 'pnae_limitacao_banheiro', label: 'Limitação para usar o banheiro sozinho', type: YESNO },
      { key: 'pnae_limitacao_banheiro_detalhe', label: 'Detalhamento (banheiro)', type: 'textarea' },
      { key: 'pnae_limitacao_locomocao', label: 'Limitação para se locomover sozinho', type: YESNO },
      { key: 'pnae_limitacao_locomocao_detalhe', label: 'Detalhamento (locomoção)', type: 'textarea' },
      { key: 'pnae_acompanhante_capacitado', label: 'Acompanhante indicado é capacitado para atender as necessidades a bordo', type: YESNO },
      { key: 'pnae_necessario_profissional_saude', label: 'É necessário viajar com um profissional de saúde', type: YESNO },
      { key: 'pnae_local', label: 'Local', type: 'text' },
      { key: 'pnae_data', label: 'Data', type: 'date' },
    ],
  },
]

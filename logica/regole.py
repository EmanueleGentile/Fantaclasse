from typing import List, Dict
from logica.modelli import (
    MATERIE_UFFICIALI,
    VotoScolastico,
    EventoDisciplinare,
    FormazioneGiornata,
    RosaUtente
)

#calcolo dei punti
def calcola_punti_voto(voto: float) -> float:
    """
    Converte un voto scolastico numerico nel relativo bonus/malus:
    - Voto tra 9.0 e 10.0      -> +5.0
    - Voto tra 8.0 e 9- (8.75) -> +4.0
    - Voto tra 7- (6.75) e 8-  -> +3.0
    - Voto tra 6.0 e 6.5       -> +1.0
    - Voto tra 5.0 e 6- (5.75) -> -1.0
    - Voto tra 4.5 e 5- (4.75) -> -2.0
    - Voto tra 4.0 e 4+ (4.25) -> -3.0
    - Voto < 4.0               -> -5.0
    """
    if voto >= 9.0:
        return 5.0
    elif voto >= 8.0:  # Da 8.0 a 8.75 (9-)
        return 4.0
    elif voto >= 6.75: # Da 6.75 (7-) a 7.75 (8-)
        return 3.0
    elif voto >= 6.0:  # Da 6.0 a 6.5
        return 1.0
    elif voto >= 5.0:  # Da 5.0 a 5.75 (6-)
        return -1.0
    elif voto >= 4.5:  # Da 4.5 a 4.75 (5-)
        return -2.0
    elif voto >= 4.0:  # Da 4.0 a 4.25 (4+)
        return -3.0
    else:              # Minore di 4.0
        return -5.0


#penalità
def calcola_malus_disciplina(evento: EventoDisciplinare) -> float:
    """
    Calcola i malus disciplinari:
    - Assenza: -1.0
    - Ritardo: -0.5
    - Entrata in seconda/terza ora: -0.5
    - Nota generica (indiv. / gruppo 2-5 persone): -2.0
    - Nota disciplinare (indiv. / gruppo 2-5 persone): -4.0
    """
    malus_assenze = evento.assenze * -1.0
    malus_ritardi = evento.ritardi * -0.5
    malus_entrate_ritardo = getattr(evento, 'entrate_ritardo', 0) * -0.5
    malus_note_gen = evento.note_generiche * -2.0
    malus_note_disc = evento.note_disciplinari * -4.0

    return (
        malus_assenze +
        malus_ritardi +
        malus_entrate_ritardo +
        malus_note_gen +
        malus_note_disc
    )


#questa parte è complicata, verifica attraverso dei cicli la validità di una materia e se il giocatore è posseduto
def convalida_formazione(formazione: FormazioneGiornata, rosa: RosaUtente) -> bool:
    """
    Verifica che la formazione copra le 9 materie ufficiali,
    che gli studenti appartengano alla rosa acquistata all'asta
    e che nessuno studente sia schierato in più di una materia.
    """
    schieramento = formazione.schieramento

    # Verifica che ci siano esattamente le 9 materie ufficiali
    if len(schieramento) != len(MATERIE_UFFICIALI):
        return False

    for materia in MATERIE_UFFICIALI:
        if materia not in schieramento:
            return False

    ids_posseduti = [acq.id_studente for acq in rosa.giocatori_acquistati]
    studenti_schierati = set()

    for id_schierato in schieramento.values():
        # Verifica che lo studente appartenga alla rosa
        if id_schierato not in ids_posseduti:
            return False
        # Verifica che lo studente non sia già stato schierato in un'altra materia
        if id_schierato in studenti_schierati:
            return False
        studenti_schierati.add(id_schierato)

    return True


#calcolo punteggio
def calcola_punteggio_giornata(
    formazione: FormazioneGiornata,
    voti: List[VotoScolastico],
    disciplina: List[EventoDisciplinare]
) -> float:
    """
    Calcola il totale dei punti della squadra per la giornata corrente.
    Solo i voti presi nella specifica materia in cui lo studente è schierato contano.
    """
    punteggio_totale = 0.0

    # Crea una mappa id_studente -> materia per un controllo veloce
    # Nota: assumiamo che convalida_formazione sia già passata, quindi ogni studente ha 1 sola materia
    studente_a_materia = {id_stud: materia for materia, id_stud in formazione.schieramento.items()}

    for v in voti:
        # Se lo studente schierato prende un voto nella STESSA materia in cui l'abbiamo schierato
        if v.id_studente in studente_a_materia and v.materia == studente_a_materia[v.id_studente]:
            punteggio_totale += calcola_punti_voto(v.voto)

    for d in disciplina:
        # Le note/assenze si applicano a prescindere dalla materia, basta che lo studente sia schierato
        if d.id_studente in studente_a_materia:
            punteggio_totale += calcola_malus_disciplina(d)

    return punteggio_totale
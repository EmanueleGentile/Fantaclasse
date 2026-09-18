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
    Verifica che la formazione copra le 9 materie ufficiali
    e che gli studenti appartengano alla rosa acquistata all'asta.
    """
    schieramento = formazione.schieramento

    for materia in MATERIE_UFFICIALI:
        if materia not in schieramento:
            return False

    ids_posseduti = [acq.id_studente for acq in rosa.giocatori_acquistati]

    for id_schierato in schieramento.values():
        if id_schierato not in ids_posseduti:
            return False

    return True


#calcolo punteggio
def calcola_punteggio_giornata(
    formazione: FormazioneGiornata,
    voti: List[VotoScolastico],
    disciplina: List[EventoDisciplinare]
) -> float:
    """
    Calcola il totale dei punti della squadra per la giornata corrente.
    """
    punteggio_totale = 0.0
    studenti_schierati = set(formazione.schieramento.values())

    for v in voti:
        if v.id_studente in studenti_schierati:
            punteggio_totale += calcola_punti_voto(v.voto)

    for d in disciplina:
        if d.id_studente in studenti_schierati:
            punteggio_totale += calcola_malus_disciplina(d)

    return punteggio_totale
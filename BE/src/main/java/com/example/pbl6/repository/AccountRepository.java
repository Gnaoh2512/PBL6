package com.example.pbl6.repository;

import com.example.pbl6.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AccountRepository extends JpaRepository<Account, Integer> {
    Optional<Account> findByUsername(String username);
    boolean existsByUsername(String username);
    Optional<Account> findByEmail(String email);
    boolean existsByEmail(String email);

    /** Active non-customer accounts that can be put on the work schedule. */
    @Query("""
            select a from Account a
              join fetch a.role r
            where upper(r.roleCode) <> 'ROLE_CUSTOMER'
              and (a.status is null or upper(a.status) not in ('INACTIVE', 'LOCKED'))
            order by r.roleCode asc, a.fullName asc
            """)
    List<Account> findSchedulableStaff();
}
